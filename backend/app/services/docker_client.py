from datetime import UTC, datetime
from functools import wraps
from pathlib import Path
from uuid import UUID

import redis
from app.config import settings
from app.schemas.build import LogEntry, StreamEvent
from loguru import logger

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound


class DockerDaemonUnavailableError(Exception):
    pass


_client: docker.DockerClient | None = None


def _get_client() -> docker.DockerClient:
    global _client
    if _client is None:
        _client = docker.from_env()
    return _client


def require_docker(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            _get_client().ping()
        except DockerException as e:
            logger.error(f"Docker check failed before calling {func.__name__}: {e}")
            raise DockerDaemonUnavailableError(
                "Docker daemon is not running. Please start Docker."
            ) from e
        return func(*args, **kwargs)

    return wrapper


@require_docker
def build_image(
    source_dir: str,
    dockerfile_content: str,
    dockerignore_content: str,
    tag: str,
    build_args: dict | None = None,
    no_cache: bool = False,
    build_id: UUID | None = None,
) -> tuple[str | None, list[dict]]:

    source = Path(source_dir)

    (source / "Dockerfile").write_text(dockerfile_content)
    (source / ".dockerignore").write_text(dockerignore_content)

    redis_client = None
    if build_id:
        redis_client = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT)

    log_lines = []
    line_counter = 1
    image_id = None

    try:
        resp = _get_client().api.build(
            path=source_dir,
            tag=tag,
            buildargs=build_args or {},
            nocache=no_cache,
            rm=True,
            timeout=settings.BUILD_TIMEOUT_SECONDS,
            pull=True,
            forcerm=True,
            container_limits=settings.container_limits,
            decode=True,
            network_mode="bridge",
        )

        for chunk in resp:
            if "stream" in chunk:
                line = chunk["stream"].rstrip("\n")
                if line:
                    now = datetime.now(UTC)
                    log_dict = {
                        "line": line_counter,
                        "message": line,
                        "stream": "stdout",
                        "timestamp": now.isoformat(),
                    }
                    log_lines.append(log_dict)
                    logger.debug(f"[build] {line}")

                    if redis_client:
                        log_entry = LogEntry(
                            line=line_counter,
                            message=line,
                            stream="stdout",
                            timestamp=now,
                        )
                        event = StreamEvent(status="building", log=log_entry)
                        redis_client.publish(
                            f"build:{build_id}", event.model_dump_json()
                        )
                    line_counter += 1

            if "error" in chunk:
                error_msg = chunk["error"].rstrip("\n")
                error_now = datetime.now(UTC)
                error_dict = {
                    "line": line_counter,
                    "message": f"ERROR: {error_msg}",
                    "stream": "stderr",
                    "timestamp": error_now.isoformat(),
                }
                log_lines.append(error_dict)
                logger.error(f"[build] {error_msg}")

                if redis_client:
                    log_entry = LogEntry(
                        line=line_counter,
                        message=f"ERROR: {error_msg}",
                        stream="stderr",
                        timestamp=error_now,
                    )
                    event = StreamEvent(status="failed", log=log_entry)
                    redis_client.publish(f"build:{build_id}", event.model_dump_json())

                raise BuildError(error_msg, iter(log_lines))

            if "aux" in chunk and "ID" in chunk["aux"]:
                image_id = chunk["aux"]["ID"]

    except BuildError:
        raise
    except APIError as err:
        logger.error(f"Docker API error during build: {err}")
        raise

    finally:
        if redis_client:
            redis_client.close()

    return image_id, log_lines


@require_docker
def get_image_layers(tag: str) -> list[dict]:
    try:
        image = _get_client().images.get(tag)
        history = image.history()
        layers = []
        for layer in history:
            size = layer.get("Size", 0)
            if size > 0:
                layers.append(
                    {
                        "instruction": layer.get("CreatedBy", ""),
                        "size_bytes": size,
                        "size_human": _format_size(size),
                        "created_at": layer.get("Created"),
                    }
                )
        return layers
    except ImageNotFound:
        logger.warning(f"Image {tag} not found for layer analysis")
        return []


@require_docker
def get_image_size(tag: str) -> int | None:
    try:
        image = _get_client().images.get(tag)
        return image.attrs.get("Size", 0)
    except ImageNotFound:
        logger.error(f"Image {tag} not found to get size")
        return None


@require_docker
def save_image(tag: str):
    try:
        image = _get_client().images.get(tag)
        return image.save(named=True)
    except ImageNotFound:
        logger.error(f"Image {tag} not found for download")
        return None


@require_docker
def remove_image(tag: str) -> bool:
    try:
        _get_client().images.remove(tag, force=True)
        logger.debug(f"Removed image {tag}")
        return True
    except ImageNotFound:
        logger.debug(f"Image {tag} not found to remove")
        return False
    except APIError as err:
        logger.error(f"Failed to remove image {tag}: {err}")
        return False


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
