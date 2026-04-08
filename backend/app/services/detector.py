import json
import re
from pathlib import Path

from app.core.constants import C_EXTENSIONS, CPP_EXTENSIONS, IGNORE_DIRS
from app.core.languages import LANGUAGES
from app.schemas.common import SupportedLanguage
from app.schemas.project import SourceAnalysisResponse
from loguru import logger


def _should_skip(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def _collect_files(source_dir: Path) -> dict:
    try:
        all_files = [
            f
            for f in source_dir.rglob("*")
            if f.is_file() and not _should_skip(f.relative_to(source_dir))
        ]
        return {
            "extensions": {f.suffix.lower() for f in all_files},
            "root_files": {f.name for f in source_dir.iterdir() if f.is_file()},
        }
    except OSError as err:
        logger.error(f"Failed to scan source directory {source_dir}: {err}")
        return {"extensions": set(), "root_files": set()}


def _score_languages(files: dict) -> dict[str, int]:
    scores = {}
    for lang, config in LANGUAGES.items():
        score = 0
        for dep_file in config["dependency_files"]:
            if dep_file in files["root_files"]:
                score += 2
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
    if lang == "rust":
        return 1 if ".rs" in found_extensions else 0
    return 0


def _pick_winner(scores: dict[str, int]) -> tuple[str | None, float]:
    if not scores:
        return None, 0.0
    sorted_langs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_score, top_lang = sorted_langs[0][1], sorted_langs[0][0]
    if len(sorted_langs) == 1:
        return top_lang, 1.0
    second_score = sorted_langs[1][1]
    return top_lang, round(top_score / (top_score + second_score), 2)


def _read_dep_content(source_dir: Path) -> tuple[str, str | None]:
    for name in ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"]:
        path = source_dir / name
        if path.exists():
            return path.read_text(errors="ignore").lower(), name
    return "", None


def _find_python_entry(source_dir: Path, pattern: str) -> str | None:
    for py in source_dir.rglob("*.py"):
        if _should_skip(py.relative_to(source_dir)):
            continue
        try:
            if pattern in py.read_text(errors="ignore"):
                rel = py.relative_to(source_dir)
                module = (
                    str(rel).replace("\\", ".").replace("/", ".").removesuffix(".py")
                )
                return f"{module}:app"
        except OSError as err:
            logger.warning(f"Failed to read {py}: {err}")
            continue
    return None


def _read_package_json(source_dir: Path) -> dict | None:
    pkg = source_dir / "package.json"
    if not pkg.exists():
        return None
    try:
        return json.loads(pkg.read_text(errors="ignore"))
    except json.JSONDecodeError as err:
        logger.error(f"Failed to parse package.json: {err}")
        return None


def _detect_python(source_dir: Path, dep_content: str) -> dict:
    if "django" in dep_content or (source_dir / "manage.py").exists():
        entry = "myproject.wsgi:application"
        for wsgi in source_dir.rglob("wsgi.py"):
            if _should_skip(wsgi.relative_to(source_dir)):
                continue
            rel = wsgi.relative_to(source_dir).parent
            entry = f"{rel}.wsgi:application"
            break
        return {
            "framework": "django",
            "entry_point": entry,
            "startup_command": f"gunicorn --bind 0.0.0.0:8000 --workers 4 {entry}",
            "port": 8000,
        }

    if "fastapi" in dep_content or "uvicorn" in dep_content:
        entry = _find_python_entry(source_dir, "FastAPI(") or "main:app"
        return {
            "framework": "fastapi",
            "entry_point": entry,
            "startup_command": f"uvicorn {entry} --host 0.0.0.0 --port 8000",
            "port": 8000,
        }

    if "flask" in dep_content:
        entry = _find_python_entry(source_dir, "Flask(") or "app:app"
        return {
            "framework": "flask",
            "entry_point": entry,
            "startup_command": f"gunicorn --bind 0.0.0.0:5000 --workers 4 {entry}",
            "port": 5000,
        }

    logger.debug("Python: no framework detected, user must configure manually")
    return {
        "framework": "fastapi",
        "entry_point": None,
        "startup_command": None,
        "port": 8000,
    }


def _detect_node(source_dir: Path) -> dict:
    data = _read_package_json(source_dir) or {}
    deps = {
        **data.get("dependencies", {}),
        **data.get("devDependencies", {}),
    }  # Merge both dicts
    scripts = data.get("scripts", {})

    if "@nestjs/core" in deps:

        entry = "dist/src/main"
        start_prod = scripts.get("start:prod", "")
        if "dist/main" in start_prod and "dist/src/main" not in start_prod:
            entry = "dist/main"
        return {
            "framework": "nestjs",
            "entry_point": entry,
            "startup_command": f"node {entry}",
            "port": 3000,
        }

    frontend_deps = ["vite", "react", "vue", "svelte", "@angular/core"]
    if any(dep in deps for dep in frontend_deps):
        output_dir = "dist"
        for cfg in ["vite.config.ts", "vite.config.js"]:
            cfg_path = source_dir / cfg
            if cfg_path.exists():
                content = cfg_path.read_text(errors="ignore")
                m = re.search(r'outDir\s*:\s*["\']([^"\']+)["\']', content)
                if m:
                    output_dir = m.group(1)
                break
        return {
            "framework": "vite-spa",
            "startup_command": "npm run build",
            "build_output_dir": output_dir,
            "port": 80,
            "note": "Static files served by Nginx",
        }

    # Express / generic backend Node
    startup = None
    if "start" in scripts:
        startup = "npm start"
    elif "serve" in scripts:
        startup = "npm run serve"
    elif (source_dir / "index.js").exists():
        startup = "node index.js"
    elif (source_dir / "server.js").exists():
        startup = "node server.js"

    return {
        "framework": "express",
        "startup_command": startup,
        "port": 3000,
    }


def _detect_go(source_dir: Path) -> dict:
    binary_name = "server"
    go_version = None
    build_package = "."

    gomod = source_dir / "go.mod"
    if gomod.exists():
        try:
            content = gomod.read_text()
            lines = content.splitlines()
            # Parse module name from first line
            first_line = lines[0]
            parts = first_line.split()
            if len(parts) >= 2:
                binary_name = parts[-1].split("/")[-1]
            # Parse go version
            for line in lines:
                stripped = line.strip()
                if stripped.startswith("go ") and not stripped.startswith("go."):
                    go_version = stripped.split()[1]
                    break
        except (IndexError, OSError) as err:
            logger.error(f"Failed to parse go.mod: {err}")

    cmd_dir = source_dir / "cmd"
    if cmd_dir.is_dir():
        subdirs = [d for d in cmd_dir.iterdir() if d.is_dir()]
        if len(subdirs) == 1:
            # Single cmd entry
            build_package = f"./cmd/{subdirs[0].name}"
            binary_name = subdirs[0].name
            logger.debug(f"Go: detected cmd/ layout → build_package={build_package}")
        elif len(subdirs) > 1:
            # Multiple entries, look for one matching module name, or pick first
            for sd in subdirs:
                if sd.name == binary_name:
                    build_package = f"./cmd/{sd.name}"
                    break
            else:
                build_package = f"./cmd/{subdirs[0].name}"
                binary_name = subdirs[0].name
            logger.debug(f"Go: multiple cmd/ entries, picked {build_package}")

    base_image = None
    if go_version:
        # go_version can be "1.24.0" or "1.22", use major.minor for image tag
        parts = go_version.split(".")
        if len(parts) >= 2:
            base_image = f"golang:{parts[0]}.{parts[1]}-alpine"
            logger.debug(
                f"Go: using base image {base_image} from go.mod version {go_version}"
            )

    return {
        "framework": "default",
        "binary_name": binary_name,
        "build_package": build_package,
        "startup_command": f"./{binary_name}",
        "port": 8080,
        "base_image": base_image,
    }


def _detect_java(source_dir: Path, files: dict) -> dict:
    # Spring Boot
    is_spring = False
    for dep_file in ["pom.xml", "build.gradle", "build.gradle.kts"]:
        path = source_dir / dep_file
        if path.exists():
            content = path.read_text(errors="ignore").lower()
            if "spring-boot" in content or "org.springframework.boot" in content:
                is_spring = True
                break

    if is_spring and "pom.xml" in files["root_files"]:
        return {
            "framework": "spring-boot",
            "startup_command": "java -jar app.jar",
            "port": 8080,
        }

    if "pom.xml" in files["root_files"]:
        return {
            "framework": "maven",
            "startup_command": "java -jar app.jar",
            "port": 8080,
        }

    if (
        "build.gradle" in files["root_files"]
        or "build.gradle.kts" in files["root_files"]
    ):
        return {
            "framework": "gradle",
            "startup_command": "java -jar app.jar",
            "port": 8080,
        }

    return {
        "framework": "maven",
        "startup_command": "java -jar app.jar",
        "port": 8080,
    }


def _detect_rust(source_dir: Path) -> dict:
    binary_name = "app"
    cargo = source_dir / "Cargo.toml"
    if cargo.exists():
        try:
            in_package = False
            for line in cargo.read_text().splitlines():
                stripped = line.strip()
                if stripped.startswith("["):
                    in_package = stripped == "[package]"
                    continue
                if in_package and stripped.startswith("name") and "=" in stripped:
                    binary_name = stripped.split("=")[1].strip().strip('"').strip("'")
                    break
        except OSError as err:
            logger.error(f"Failed to parse Cargo.toml: {err}")

    return {
        "framework": "default",
        "binary_name": binary_name,
        "startup_command": f"./{binary_name}",
    }


def _detect_c_cpp(source_dir: Path, files: dict) -> dict:
    binary_name = "app"

    if "CMakeLists.txt" in files["root_files"]:
        cmake = source_dir / "CMakeLists.txt"
        if cmake.exists():
            content = cmake.read_text(errors="ignore")
            m = re.search(r"add_executable\s*\(\s*(\w+)", content)
            if m:
                binary_name = m.group(1)
            else:
                m = re.search(r"project\s*\(\s*(\w+)", content)
                if m:
                    binary_name = m.group(1)
        return {
            "framework": "cmake",
            "binary_name": binary_name,
            "startup_command": f"./{binary_name}",
        }

    return {
        "framework": "makefile",
        "binary_name": binary_name,
        "startup_command": f"./{binary_name}",
    }


_INFERRERS = {
    "python": lambda sd, f: _detect_python(sd, _read_dep_content(sd)[0]),
    "node": lambda sd, f: _detect_node(sd),
    "go": lambda sd, f: _detect_go(sd),
    "java": lambda sd, f: _detect_java(sd, f),
    "rust": lambda sd, f: _detect_rust(sd),
    "c": lambda sd, f: _detect_c_cpp(sd, f),
    "cpp": lambda sd, f: _detect_c_cpp(sd, f),
}


def detect_language(source_dir: Path) -> SourceAnalysisResponse:
    # Unwrap single top-level directory (common with zip/tar archives)
    children = list(source_dir.iterdir())
    if len(children) == 1 and children[0].is_dir():
        source_dir = children[0]

    files = _collect_files(source_dir)
    scores = _score_languages(files)
    best_lang, confidence = _pick_winner(scores)

    if best_lang is None:
        logger.warning(f"Could not detect language in {source_dir}")
        return SourceAnalysisResponse(
            detected_files=list(files["root_files"]),
            has_existing_dockerfile="Dockerfile" in files["root_files"],
            warnings=["Could not detect programming language"],
        )

    inferrer = _INFERRERS.get(best_lang)
    result = inferrer(source_dir, files) if inferrer else {"framework": "default"}

    dep_file = None
    for df in LANGUAGES[best_lang]["dependency_files"]:
        if df in files["root_files"]:
            dep_file = df
            break

    warnings = []
    if len(scores) > 1:
        others = [lang for lang in scores if lang != best_lang]
        warnings.append(
            f"Multiple languages detected: also found indicators for {', '.join(others)}"
        )

    logger.info(
        f"Detected {best_lang}/{result.get('framework')} "
        f"confidence={confidence} dep={dep_file}"
    )

    return SourceAnalysisResponse(
        detected_language=SupportedLanguage(best_lang),
        detected_framework=result.get("framework"),
        confidence=confidence,
        detected_dependency_file=dep_file,
        suggested_startup_command=result.get("startup_command"),
        detected_entry_point=result.get("entry_point"),
        detected_binary_name=result.get("binary_name"),
        detected_build_output_dir=result.get("build_output_dir"),
        detected_build_package=result.get("build_package"),
        detected_base_image=result.get("base_image"),
        detected_port=result.get("port"),
        detected_files=list(files["root_files"]),
        has_existing_dockerfile="Dockerfile" in files["root_files"],
        note=result.get("note"),
        warnings=warnings,
    )
