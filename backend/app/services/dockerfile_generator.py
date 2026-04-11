from pathlib import Path
from typing import Any

from app.core.languages import LANGUAGES
from app.schemas.project import Project
from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    keep_trailing_newline=True,
)

# Default .dockerignore content per language
DOCKERIGNORE = {
    "python": ".git\n.env\n.env.*\nvenv\n.venv\n__pycache__\n*.pyc\n*.pyo\n.mypy_cache\n.pytest_cache\n.ruff_cache\n",
    "node": ".git\n.env\n.env.*\nnode_modules\ndist\nbuild\nnpm-debug.log\n.next\n",
    "go": ".git\n.env\n.env.*\nvendor\n*.test\n",
    "java": ".git\n.env\n.env.*\ntarget\nbuild\n.gradle\n*.class\n*.jar\n",
    "rust": ".git\n.env\n.env.*\ntarget\n",
    "c": ".git\n.env\n.env.*\nbuild\n*.o\n*.so\n*.a\n",
    "cpp": ".git\n.env\n.env.*\nbuild\n*.o\n*.so\n*.a\n",
}


def _get_template_path(language: str, framework: str) -> str:
    lang_config = LANGUAGES.get(language)
    if not lang_config:
        raise ValueError(f"Unsupported language: {language}")

    for fw in lang_config["frameworks"]:
        if fw["name"] == framework:
            return fw["template"]

    valid = [fw["name"] for fw in lang_config["frameworks"]]
    raise ValueError(
        f"Unsupported framework '{framework}' for {language}. Options: {valid}"
    )


def generate_dockerfile(
    project: Project, custom_env_vars: list[Any] | None = None
) -> str:
    if not project.language:
        raise ValueError("Project language is required to generate a Dockerfile")
    if not project.framework:
        raise ValueError("Project framework is required to generate a Dockerfile")
    lang_str = (
        project.language.value
        if hasattr(project.language, "value")
        else str(project.language)
    )
    template_path = _get_template_path(lang_str, project.framework)
    template = env.get_template(template_path)
    return template.render(
        base_image=project.base_image,
        dependency_file=project.dependency_file,
        startup_command=project.startup_command,
        entry_point=project.entry_point,
        binary_name=project.binary_name,
        build_output_dir=project.build_output_dir,
        build_package=project.build_package,
        port=project.port,
        env_vars=custom_env_vars or project.env_vars or [],
    )


def generate_dockerignore(language: str) -> str:
    return DOCKERIGNORE.get(language, ".git\n.env\n.env.*\n")
