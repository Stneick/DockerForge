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
    display_name: str
    default_base_image: str
    dependency_files: list[str]
    startup_command: str
    default_port: int | None
    supports_multi_stage: bool


LANGUAGE_INDICATORS: dict[str, LanguageIndicator] = {
    "python": {
        "display_name": "Python",
        "default_base_image": "python:3.12-slim",
        "dependency_files": [
            "requirements.txt",
            "Pipfile",
            "pyproject.toml",
            "setup.py",
            "setup.cfg",
        ],
        "startup_command": "python main.py",
        "default_port": 8000,
        "supports_multi_stage": False,
    },
    "node": {
        "display_name": "Node.js",
        "default_base_image": "node:20-alpine",
        "dependency_files": ["package.json", "yarn.lock", "pnpm-lock.yaml"],
        "startup_command": "node index.js",
        "default_port": 3000,
        "supports_multi_stage": False,
    },
    "go": {
        "display_name": "Go",
        "default_base_image": "golang:1.22-alpine",
        "dependency_files": ["go.mod", "go.sum"],
        "startup_command": "./app",
        "default_port": 8080,
        "supports_multi_stage": True,
    },
    "java": {
        "display_name": "Java",
        "default_base_image": "eclipse-temurin:21-jdk-alpine",
        "dependency_files": ["pom.xml", "build.gradle", "build.gradle.kts"],
        "startup_command": "java -jar app.jar",
        "default_port": 8080,
        "supports_multi_stage": True,
    },
    "c": {
        "display_name": "C",
        "default_base_image": "gcc:13-bookworm",
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "startup_command": "./app",
        "default_port": None,
        "supports_multi_stage": True,
    },
    "cpp": {
        "display_name": "C++",
        "default_base_image": "gcc:13-bookworm",
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "startup_command": "./app",
        "default_port": None,
        "supports_multi_stage": True,
    },
}
