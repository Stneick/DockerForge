from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    keep_trailing_newline=True,
)


def _get_template_name(language: str, is_frontend: bool = False) -> str:
    if language == "node" and is_frontend:
        return "node-frontend.Dockerfile.j2"
    if language == "node":
        return "node-backend.Dockerfile.j2"

    template_map = {
        "python": "python.Dockerfile.j2",
        "go": "go.Dockerfile.j2",
        "java": "java.Dockerfile.j2",
        "c": "c.Dockerfile.j2",
        "cpp": "cpp.Dockerfile.j2",
    }
    name = template_map.get(language)
    if not name:
        raise ValueError(f"No template for language: {language}")
    return name


def generate_dockerfile(
    language: str,
    dependency_file: str | None = None,
    startup_command: str | None = None,
    port: int | None = None,
    env_vars: list[Any] | None = None,
    base_image: str | None = None,
    is_frontend: bool = False,
) -> str:
    template_name = _get_template_name(language, is_frontend)
    template = env.get_template(template_name)
    return template.render(
        base_image=base_image,
        dependency_file=dependency_file,
        startup_command=startup_command,
        port=port,
        env_vars=env_vars or [],
        is_frontend=is_frontend,
    )
