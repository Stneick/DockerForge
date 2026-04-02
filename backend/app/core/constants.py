from typing import TypedDict

ALLOWED_EXTENSIONS = (".zip", ".tar.gz", ".tgz")

C_EXTENSIONS = {".c", ".h"}
CPP_EXTENSIONS = {".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".h++"}

IGNORE_DIRS = {
    "venv",
    ".venv",
    "env",
    ".env",
    "node_modules",
    "__pycache__",
    ".git",
    "dist",
    "build",
    "target",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "vendor",
    "third_party",
}


class LanguageIndicator(TypedDict):
    dependency_files: list[str]
    startup_command: str
    default_port: int | None


LANGUAGE_INDICATORS: dict[str, LanguageIndicator] = {
    "python": {
        "dependency_files": [
            "requirements.txt",
            "Pipfile",
            "pyproject.toml",
            "setup.py",
            "setup.cfg",
        ],
        "startup_command": "python main.py",
        "default_port": 8000,
    },
    "node": {
        "dependency_files": ["package.json", "yarn.lock", "pnpm-lock.yaml"],
        "startup_command": "node index.js",
        "default_port": 3000,
    },
    "go": {
        "dependency_files": ["go.mod", "go.sum"],
        "startup_command": "./app",
        "default_port": 8080,
    },
    "java": {
        "dependency_files": ["pom.xml", "build.gradle", "build.gradle.kts"],
        "startup_command": "java -jar app.jar",
        "default_port": 8080,
    },
    "c": {
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "startup_command": "./app",
        "default_port": None,
    },
    "cpp": {
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "startup_command": "./app",
        "default_port": None,
    },
}
