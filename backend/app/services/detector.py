import json
from pathlib import Path

from app.core.constants import C_EXTENSIONS, CPP_EXTENSIONS, LANGUAGE_INDICATORS
from app.schemas.common import SupportedLanguage
from app.schemas.project import SourceAnalysisResponse
from loguru import logger


def _collect_files(source_dir: Path) -> dict:
    try:
        return {
            "names": {f.name for f in source_dir.rglob("*") if f.is_file()},
            "extensions": {
                f.suffix.lower() for f in source_dir.rglob("*") if f.is_file()
            },
            "root_files": {f.name for f in source_dir.iterdir() if f.is_file()},
        }
    except OSError as err:
        logger.error(f"Failed to scan source directory {source_dir}: {err}")
        return {"names": set(), "extensions": set(), "root_files": set()}


def _score_languages(files: dict, source_dir: Path) -> dict[str, int]:
    scores = {}
    for lang, config in LANGUAGE_INDICATORS.items():
        score = 0
        for dep_file in config["dependency_files"]:
            if dep_file in files["root_files"]:
                score += 2  # dep file is a strong signal, weight it more
        score += _check_extensions(lang, files["extensions"])
        if score > 0:
            scores[lang] = score
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
        return None, 0.0

    sorted_langs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_score = sorted_langs[0][1]
    top_lang = sorted_langs[0][0]

    if len(sorted_langs) == 1:
        return top_lang, 1.0

    second_score = sorted_langs[1][1]
    # confidence = how much better the winner is vs the runner-up
    confidence = round(top_score / (top_score + second_score), 2)
    return top_lang, confidence


def _infer_python_startup(source_dir: Path) -> str:
    dep_files = ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"]
    for dep_file in dep_files:
        path = source_dir / dep_file
        if path.exists():
            content = path.read_text(errors="ignore").lower()
            if "fastapi" in content or "uvicorn" in content:
                return "uvicorn main:app --host 0.0.0.0 --port 8000"
            if "flask" in content:
                return "flask run --host 0.0.0.0"
            if "django" in content:
                return "python manage.py runserver 0.0.0.0:8000"
    if (source_dir / "manage.py").exists():  # Django without requirements.txt
        return "python manage.py runserver 0.0.0.0:8000"
    if (source_dir / "main.py").exists():
        return "python main.py"
    return "python app.py"  # fallback


def _infer_node_startup(source_dir: Path) -> str:
    pkg = source_dir / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(errors="ignore"))
            scripts = data.get("scripts", {})
            if "start" in scripts:
                return "npm start"
            if "serve" in scripts:
                return "npm run serve"
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse package.json in {source_dir}: {err}")
    return "node index.js"


def _infer_go_startup(source_dir: Path) -> str:
    gomod = source_dir / "go.mod"
    if gomod.exists():
        try:
            first_line = gomod.read_text().splitlines()[0]
            parts = first_line.split()
            if len(parts) >= 2:
                module_name = parts[-1].split("/")[-1]
                return f"./{module_name}"
        except (IndexError, OSError) as err:
            logger.error(f"Failed to parse go.mod in {source_dir}: {err}")
    return "./app"


_STARTUP_INFERRERS = {
    "python": _infer_python_startup,
    "node": _infer_node_startup,
    "go": _infer_go_startup,
}


def _infer_startup_command(lang: str, source_dir: Path) -> str:
    inferrer = _STARTUP_INFERRERS.get(lang)
    if inferrer is None:
        return LANGUAGE_INDICATORS[lang]["startup_command"]  # fallback to constant
    return inferrer(source_dir)


def detect_language(source_dir: Path) -> SourceAnalysisResponse:
    files = _collect_files(source_dir)  # returns set of relative paths/names
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
            warnings=["Could not detect programming language"],
        )

    startup_cmd = _infer_startup_command(best_lang, source_dir)

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
        warnings=warnings,
    )
