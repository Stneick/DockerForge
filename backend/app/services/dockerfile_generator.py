from pathlib import Path
from typing import Any

from app.core.languages import LANGUAGES
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
    language: str,
    framework: str,
    dependency_file: str | None = None,
    startup_command: str | None = None,
    entry_point: str | None = None,
    binary_name: str | None = None,
    build_output_dir: str | None = None,
    build_package: str | None = None,
    port: int | None = None,
    env_vars: list[Any] | None = None,
    base_image: str | None = None,
) -> str:
    template_path = _get_template_path(language, framework)
    template = env.get_template(template_path)
    return template.render(
        base_image=base_image,
        dependency_file=dependency_file,
        startup_command=startup_command,
        entry_point=entry_point,
        binary_name=binary_name,
        build_output_dir=build_output_dir,
        build_package=build_package,
        port=port,
        env_vars=env_vars or [],
    )


def generate_dockerignore(language: str) -> str:
    return DOCKERIGNORE.get(language, ".git\n.env\n.env.*\n")
