import json
from pathlib import Path

from app.core.constants import (
    C_EXTENSIONS,
    CPP_EXTENSIONS,
    IGNORE_DIRS,
    LANGUAGE_INDICATORS,
)
from app.schemas.common import SupportedLanguage
from app.schemas.project import SourceAnalysisResponse
from loguru import logger


def _should_skip(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def _collect_files(source_dir: Path) -> dict:
    logger.debug(f"Scanning source directory: {source_dir}")
    try:
        all_files = [
            f
            for f in source_dir.rglob("*")
            if f.is_file() and not _should_skip(f.relative_to(source_dir))
        ]
        result = {
            "names": {f.name for f in all_files},
            "extensions": {f.suffix.lower() for f in all_files},
            "root_files": {f.name for f in source_dir.iterdir() if f.is_file()},
        }
        logger.debug(
            f"Found {len(result['names'])} total files, {len(result['root_files'])} at root, extensions: {sorted(result['extensions'])}"
        )
        return result
    except OSError as err:
        logger.error(f"Failed to scan source directory {source_dir}: {err}")
        return {"names": set(), "extensions": set(), "root_files": set()}


def _score_languages(files: dict, source_dir: Path) -> dict[str, int]:
    scores = {}
    for lang, config in LANGUAGE_INDICATORS.items():
        score = 0
        for dep_file in config["dependency_files"]:
            if dep_file in files["root_files"]:
                logger.debug(f"[{lang}] dep file hit: {dep_file} (+2)")
                score += 2  # dep file is a strong signal, weight it more
        ext_score = _check_extensions(lang, files["extensions"])
        if ext_score:
            logger.debug(f"[{lang}] extension match (+{ext_score})")
        score += ext_score
        if score > 0:
            scores[lang] = score
            logger.debug(f"[{lang}] total score: {score}")
        else:
            logger.debug(f"[{lang}] no indicators found, skipping")
    return scores


def _check_extensions(lang: str, found_extensions: set[str]) -> int:
    if lang == "c":
        return (
            1
            if found_extensions & C_EXTENSIONS
            and not (found_extensions & CPP_EXTENSIONS)
            else 0
        )
    if lang == "cpp":
        return 1 if found_extensions & CPP_EXTENSIONS else 0
    return 0


def _pick_winner(scores: dict[str, int]) -> tuple[str | None, float]:
    if not scores:
        logger.debug("No scores to pick from")
        return None, 0.0

    sorted_langs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    logger.debug(f"Scores ranked: {sorted_langs}")
    top_score = sorted_langs[0][1]
    top_lang = sorted_langs[0][0]

    if len(sorted_langs) == 1:
        logger.debug(f"Single language match: {top_lang} → confidence=1.0")
        return top_lang, 1.0

    second_score = sorted_langs[1][1]
    # confidence = how much better the winner is vs the runner-up
    confidence = round(top_score / (top_score + second_score), 2)
    logger.debug(
        f"Winner: {top_lang} (score={top_score}) over {sorted_langs[1][0]} (score={second_score}) → confidence={confidence}"
    )
    return top_lang, confidence


def _infer_python_startup(source_dir: Path) -> str | None:
    dep_files = ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"]
    for dep_file in dep_files:
        path = source_dir / dep_file
        if path.exists():
            content = path.read_text(errors="ignore").lower()
            if "fastapi" in content or "uvicorn" in content:
                logger.debug(f"Python: found fastapi/uvicorn in {dep_file}")
                if (source_dir / "app" / "main.py").exists():
                    logger.debug("Python: found app/main.py, using app.main:app")
                    return "uvicorn app.main:app --host 0.0.0.0 --port 8000"
                return "uvicorn main:app --host 0.0.0.0 --port 8000"
            if "flask" in content:
                logger.debug(f"Python: found flask in {dep_file}")
                return "flask run --host 0.0.0.0"
            if "django" in content:
                logger.debug(f"Python: found django in {dep_file}")
                return "python manage.py runserver 0.0.0.0:8000"
    if (source_dir / "manage.py").exists():  # Django without requirements.txt
        logger.debug("Python: found manage.py (Django without dep file)")
        return "python manage.py runserver 0.0.0.0:8000"
    if (source_dir / "main.py").exists():
        logger.debug("Python: found main.py")
        return "python main.py"
    if (source_dir / "app.py").exists():
        logger.debug("Python: found app.py, falling back to python app.py")
        return "python app.py"
    logger.debug("Python: no startup command found")
    return None


def _infer_node_startup(source_dir: Path) -> str | None:
    pkg = source_dir / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(errors="ignore"))
            scripts = data.get("scripts", {})
            logger.debug(f"Node: scripts found in package.json: {list(scripts.keys())}")
            if "start" in scripts:
                logger.debug("Node: using 'start' script → npm start")
                return "npm start"
            if "serve" in scripts:
                logger.debug("Node: using 'serve' script → npm run serve")
                return "npm run serve"
            logger.debug("Node: no start/serve script found in package.json")
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse package.json in {source_dir}: {err}")
    if (source_dir / "index.js").exists():
        logger.debug("Node: found index.js, falling back to node index.js")
        return "node index.js"
    logger.debug("Node: no startup command found")
    return None


def _infer_go_startup(source_dir: Path) -> str:
    gomod = source_dir / "go.mod"
    if gomod.exists():
        try:
            first_line = gomod.read_text().splitlines()[0]
            parts = first_line.split()
            if len(parts) >= 2:
                module_name = parts[-1].split("/")[-1]
                logger.debug(
                    f"Go: parsed module path '{parts[-1]}' → binary name '{module_name}'"
                )
                return f"./{module_name}"
            logger.debug(f"Go: go.mod first line malformed: '{first_line}'")
        except (IndexError, OSError) as err:
            logger.error(f"Failed to parse go.mod in {source_dir}: {err}")
    logger.debug("Go: falling back to ./app")
    return "./app"


def _is_frontend_project(lang: str, source_dir: Path) -> bool:
    """Check if a Node project is a frontend app to potentially use Nginx"""
    if lang != "node":
        return False

    pkg = source_dir / "package.json"
    if not pkg.exists():
        return False

    try:
        data = json.loads(pkg.read_text(errors="ignore"))
        deps = {
            **data.get("dependencies", {}),
            **data.get("devDependencies", {}),
        }
        frontend_indicators = [
            "react",
            "vue",
            "vite",
            "@angular/core",
            "next",
            "nuxt",
            "svelte",
            "@sveltejs/kit",
            "gatsby",
            "astro",
        ]
        matched = [fw for fw in frontend_indicators if fw in deps]
        if matched:
            logger.debug(f"Node: frontend indicators found: {matched}")
            return True
        logger.debug("Node: no frontend indicators found, treating as backend")
        return False
    except json.JSONDecodeError:
        return False


_STARTUP_INFERRERS = {
    "python": _infer_python_startup,
    "node": _infer_node_startup,
    "go": _infer_go_startup,
}


def _infer_startup_command(lang: str, source_dir: Path) -> str | None:
    inferrer = _STARTUP_INFERRERS.get(lang)
    if inferrer is None:
        cmd = LANGUAGE_INDICATORS[lang]["startup_command"]
        logger.debug(f"No inferrer for {lang}, using constant default: {cmd}")
        return cmd
    return inferrer(source_dir)


def detect_language(source_dir: Path) -> SourceAnalysisResponse:
    # Unwrap single top-level directory (common with zip/tar archives)
    children = list(source_dir.iterdir())
    if len(children) == 1 and children[0].is_dir():
        logger.debug(
            f"Archive extracted into single subdirectory, descending into: {children[0].name}"
        )
        source_dir = children[0]

    files = _collect_files(source_dir)
    scores = _score_languages(files, source_dir)
    best_lang, confidence = _pick_winner(scores)

    if best_lang is None:
        logger.warning(
            f"Could not detect language in {source_dir}, root files: {files['root_files']}"
        )
        return SourceAnalysisResponse(
            detected_language=None,
            confidence=0.0,
            detected_dependency_file=None,
            suggested_startup_command=None,
            detected_files=list(files["root_files"]),
            has_existing_dockerfile="Dockerfile" in files["root_files"],
            is_frontend=None,
            warnings=["Could not detect programming language"],
        )

    is_frontend = _is_frontend_project(best_lang, source_dir)
    startup_cmd: str | None = _infer_startup_command(best_lang, source_dir)

    dep_file = None
    for df in LANGUAGE_INDICATORS[best_lang]["dependency_files"]:
        if df in files["root_files"]:
            dep_file = df
            break

    logger.info(
        f"Detected language={best_lang} confidence={confidence} dep_file={dep_file} in {source_dir}"
    )

    warnings = []
    if len(scores) > 1:
        others = [lang for lang in scores if lang != best_lang]
        warnings.append(
            f"Multiple languages detected: also found indicators for {', '.join(others)}"
        )

    return SourceAnalysisResponse(
        detected_language=SupportedLanguage(best_lang),
        confidence=confidence,
        detected_dependency_file=dep_file,
        suggested_startup_command=startup_cmd,
        detected_files=list(files["root_files"]),
        has_existing_dockerfile="Dockerfile" in files["root_files"],
        is_frontend=is_frontend,  # TODO is_frontend=true AND startup_cmd=null = Nginx, tell frontend!
        warnings=warnings,
    )
