from typing import TypedDict


class FrameworkConfig(TypedDict):
    name: str
    display_name: str
    template: str
    default_entry_point: str | None
    default_startup_command: str
    default_port: int | None
    note: str | None
    detection_deps: list[str]
    detection_files: list[str]


class LanguageConfig(TypedDict):
    display_name: str
    default_base_image: str
    dependency_files: list[str]
    supports_multi_stage: bool
    frameworks: list[FrameworkConfig]


LANGUAGES: dict[str, LanguageConfig] = {
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
        "supports_multi_stage": False,
        "frameworks": [
            {
                "name": "fastapi",
                "display_name": "FastAPI",
                "template": "python/fastapi.Dockerfile.j2",
                "default_entry_point": "main:app",
                "default_startup_command": "uvicorn main:app --host 0.0.0.0 --port 8000",
                "default_port": 8000,
                "note": None,
                "detection_deps": ["fastapi", "uvicorn"],
                "detection_files": [],
            },
            {
                "name": "flask",
                "display_name": "Flask",
                "template": "python/flask.Dockerfile.j2",
                "default_entry_point": "app:app",
                "default_startup_command": "gunicorn --bind 0.0.0.0:5000 --workers 4 app:app",
                "default_port": 5000,
                "note": None,
                "detection_deps": ["flask"],
                "detection_files": [],
            },
            {
                "name": "django",
                "display_name": "Django",
                "template": "python/django.Dockerfile.j2",
                "default_entry_point": "myproject.wsgi:application",
                "default_startup_command": "gunicorn --bind 0.0.0.0:8000 --workers 4 myproject.wsgi:application",
                "default_port": 8000,
                "note": None,
                "detection_deps": ["django"],
                "detection_files": ["manage.py"],
            },
        ],
    },
    "node": {
        "display_name": "Node.js",
        "default_base_image": "node:20-alpine",
        "dependency_files": ["package.json", "yarn.lock", "pnpm-lock.yaml"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "express",
                "display_name": "Express",
                "template": "node/express.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "node index.js",
                "default_port": 3000,
                "note": None,
                "detection_deps": ["express", "fastify", "koa", "hapi"],
                "detection_files": [],
            },
            {
                "name": "nestjs",
                "display_name": "NestJS",
                "template": "node/nestjs.Dockerfile.j2",
                "default_entry_point": "dist/main",
                "default_startup_command": "node dist/main",
                "default_port": 3000,
                "note": None,
                "detection_deps": ["@nestjs/core"],
                "detection_files": [],
            },
            {
                "name": "vite-spa",
                "display_name": "Vite SPA",
                "template": "node/vite-spa.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "npm run build",
                "default_port": 80,
                "note": "Static files served by Nginx",
                "detection_deps": ["vite", "react", "vue", "svelte", "@angular/core"],
                "detection_files": ["vite.config.ts", "vite.config.js"],
            },
        ],
    },
    "go": {
        "display_name": "Go",
        "default_base_image": "golang:1.22-alpine",
        "dependency_files": ["go.mod", "go.sum"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "default",
                "display_name": "Standard",
                "template": "go/default.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./server",
                "default_port": 8080,
                "note": None,
                "detection_deps": [],
                "detection_files": [],
            },
        ],
    },
    "java": {
        "display_name": "Java",
        "default_base_image": "eclipse-temurin:21-jdk-alpine",
        "dependency_files": ["pom.xml", "build.gradle", "build.gradle.kts"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "spring-boot",
                "display_name": "Spring Boot",
                "template": "java/spring-boot.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "java -jar app.jar",
                "default_port": 8080,
                "note": None,
                "detection_deps": ["spring-boot", "org.springframework.boot"],
                "detection_files": [],
            },
            {
                "name": "maven",
                "display_name": "Maven",
                "template": "java/maven.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "java -jar app.jar",
                "default_port": 8080,
                "note": None,
                "detection_deps": [],
                "detection_files": ["pom.xml"],
            },
            {
                "name": "gradle",
                "display_name": "Gradle",
                "template": "java/gradle.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "java -jar app.jar",
                "default_port": 8080,
                "note": None,
                "detection_deps": [],
                "detection_files": ["build.gradle", "build.gradle.kts"],
            },
        ],
    },
    "rust": {
        "display_name": "Rust",
        "default_base_image": "rust:1.77-slim-bookworm",
        "dependency_files": ["Cargo.toml", "Cargo.lock"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "default",
                "display_name": "Standard",
                "template": "rust/default.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./app",
                "default_port": None,
                "note": None,
                "detection_deps": [],
                "detection_files": [],
            },
        ],
    },
    "c": {
        "display_name": "C",
        "default_base_image": "gcc:13-bookworm",
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "cmake",
                "display_name": "CMake",
                "template": "c-cpp/cmake.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./app",
                "default_port": None,
                "note": None,
                "detection_deps": [],
                "detection_files": ["CMakeLists.txt"],
            },
            {
                "name": "makefile",
                "display_name": "Makefile",
                "template": "c-cpp/makefile.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./app",
                "default_port": None,
                "note": None,
                "detection_deps": [],
                "detection_files": ["Makefile"],
            },
        ],
    },
    "cpp": {
        "display_name": "C++",
        "default_base_image": "gcc:13-bookworm",
        "dependency_files": ["Makefile", "CMakeLists.txt"],
        "supports_multi_stage": True,
        "frameworks": [
            {
                "name": "cmake",
                "display_name": "CMake",
                "template": "c-cpp/cmake.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./app",
                "default_port": None,
                "note": None,
                "detection_deps": [],
                "detection_files": ["CMakeLists.txt"],
            },
            {
                "name": "makefile",
                "display_name": "Makefile",
                "template": "c-cpp/makefile.Dockerfile.j2",
                "default_entry_point": None,
                "default_startup_command": "./app",
                "default_port": None,
                "note": None,
                "detection_deps": [],
                "detection_files": ["Makefile"],
            },
        ],
    },
}
