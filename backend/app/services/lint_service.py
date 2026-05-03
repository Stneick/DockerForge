import json
import subprocess

from app.schemas.lint import LintIssue
from loguru import logger


class HadolintError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def lint_dockerfile_content(dockerfile: str, timeout: int) -> list[LintIssue]:
    if not dockerfile:
        raise HadolintError(
            message="Dockerfile content is required",
            status_code=400,
        )
    try:
        result = subprocess.run(
            ["hadolint", "--format", "json", "-"],
            input=dockerfile,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as e:
        logger.exception("Hadolint binary not found on PATH")
        raise HadolintError(
            message="Hadolint is not installed on the host. "
            "If you're running DockerForge without Docker, "
            "install hadolint: https://github.com/hadolint/hadolint#install",
            status_code=503,
        ) from e
    except subprocess.TimeoutExpired as e:
        logger.exception("Hadolint timed out")
        raise HadolintError(
            message="Hadolint timed out.",
            status_code=408,
        ) from e
    except OSError as e:
        logger.exception("Hadolint failed to execute")
        raise HadolintError(
            message="Hadolint failed to execute",
            status_code=500,
        ) from e

    if result.returncode not in (0, 1):
        logger.error(
            f"Hadolint exited with code {result.returncode}. stderr: {result.stderr}"
        )
        raise HadolintError(
            message="Hadolint failed due to an internal error",
            status_code=500,
        )

    try:
        raw_issues = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.error(
            f"Failed to parse hadolint output. "
            f"stdout: {result.stdout!r}, stderr: {result.stderr!r}"
        )
        raise HadolintError(
            message="Hadolint failed due to an internal error",
            status_code=500,
        ) from e

    return [LintIssue.model_validate(item) for item in raw_issues]
