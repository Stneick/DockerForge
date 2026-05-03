from collections.abc import Iterator
from datetime import UTC, datetime
from functools import wraps
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import UUID

import redis
from app.config import settings
from app.core.utils import format_size
from app.schemas.build import LogEntry, StreamEvent
from docker.errors import APIError, BuildError, DockerException, ImageNotFound
from loguru import logger

import docker

if TYPE_CHECKING:
    from docker.api.build import _ContainerLimits


class DockerDaemonUnavailableError(Exception):
    pass


class BuildCancelled(Exception):
    def __init__(self, build_log: list[dict] | None = None):
        super().__init__("Build cancelled")
        self.build_log = build_log or []


MANAGED_LABEL_KEY = "dockerforge.managed"
MANAGED_LABEL_VALUE = "true"


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
    build_timeout: int,
    container_limits: "_ContainerLimits",
    log_stream_max_entries: int,
    build_args: dict | None = None,
    no_cache: bool = False,
    build_id: UUID | None = None,
) -> tuple[str | None, list[dict]]:

    source = Path(source_dir)

    # Inject a managed label so the periodic cleanup task can prune leaked intermediates
    # from cancelled/failed builds without touching the host's other dangling images.
    dockerfile_content = _inject_managed_label(dockerfile_content)

    (source / "Dockerfile").write_text(dockerfile_content)
    (source / ".dockerignore").write_text(dockerignore_content)

    redis_client = None
    if build_id:
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            socket_timeout=2,
            socket_connect_timeout=2,
        )

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
            timeout=build_timeout,
            pull=True,
            forcerm=True,
            container_limits=container_limits,
            decode=True,
            network_mode="bridge",
        )

        for chunk in resp:
            if redis_client and _cancel_requested(redis_client, build_id):
                logger.info(
                    f"Cancel flag detected for build {build_id}; closing Docker stream"
                )
                cancel_now = datetime.now(UTC)
                cancel_msg = "Build cancelled by user"
                log_lines.append(
                    {
                        "line": line_counter,
                        "message": cancel_msg,
                        "stream": "stderr",
                        "timestamp": cancel_now.isoformat(),
                    }
                )

                cancel_log_entry = LogEntry(
                    line=line_counter,
                    message=cancel_msg,
                    stream="stderr",
                    timestamp=cancel_now,
                )
                cancel_event = StreamEvent(status="cancelled", log=cancel_log_entry)
                try:
                    redis_client.xadd(
                        f"build:{build_id}",
                        {"payload": cancel_event.model_dump_json()},
                        maxlen=log_stream_max_entries,
                        approximate=True,
                    )
                except redis.exceptions.RedisError as pub_err:
                    logger.debug(
                        f"Failed to publish cancel log to stream for {build_id}: {pub_err}"
                    )

                try:
                    resp.close()
                except Exception as close_err:
                    logger.debug(
                        f"Error closing Docker build stream for {build_id}: {close_err}"
                    )
                raise BuildCancelled(log_lines)

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
                        redis_client.xadd(
                            f"build:{build_id}",
                            {"payload": event.model_dump_json()},
                            maxlen=log_stream_max_entries,
                            approximate=True,
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
                    redis_client.xadd(
                        f"build:{build_id}",
                        {"payload": event.model_dump_json()},
                        maxlen=log_stream_max_entries,
                        approximate=True,
                    )

                raise BuildError(error_msg, iter(log_lines))  # type: ignore[arg-type]

            if "aux" in chunk and "ID" in chunk["aux"]:
                image_id = chunk["aux"]["ID"]

    except BuildCancelled:
        raise
    except BuildError:
        raise
    except APIError as err:
        logger.error(f"Docker API error during build: {err}")
        raise

    finally:
        if redis_client:
            redis_client.close()

    return image_id, log_lines


def _cancel_requested(redis_client: redis.Redis, build_id: UUID | None) -> bool:
    if not build_id:
        return False
    try:
        return bool(redis_client.exists(f"build:{build_id}:cancel"))
    except redis.exceptions.RedisError as e:
        logger.debug(f"Redis check failed for build {build_id} cancel flag: {e}")
        return False


def _inject_managed_label(dockerfile_content: str) -> str:
    label_line = f"LABEL {MANAGED_LABEL_KEY}={MANAGED_LABEL_VALUE}"
    output_lines = []
    for line in dockerfile_content.splitlines():
        output_lines.append(line)
        stripped = line.lstrip()
        if stripped.upper().startswith("FROM ") or stripped.upper() == "FROM":
            output_lines.append(label_line)
    trailing = "\n" if dockerfile_content.endswith("\n") else ""
    return "\n".join(output_lines) + trailing


@require_docker
def prune_managed_dangling_images(min_age: str = "10m") -> dict:
    try:
        result = _get_client().images.prune(
            filters={
                "dangling": True,
                "label": [f"{MANAGED_LABEL_KEY}={MANAGED_LABEL_VALUE}"],
                "until": min_age,
            }
        )
        deleted = result.get("ImagesDeleted") or []
        reclaimed = result.get("SpaceReclaimed", 0) or 0
        return {
            "images_deleted": len(deleted),
            "space_reclaimed": reclaimed,
        }
    except Exception as err:
        logger.warning(f"Managed dangling image prune failed: {err}")
        return {}


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
                        "size_human": format_size(size),
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
        logger.warning(f"Image {tag} not found to get size")
        return None


@require_docker
def save_image(tag: str) -> Iterator[bytes] | None:
    try:
        image = _get_client().images.get(tag)
        return image.save(named=True)
    except ImageNotFound:
        logger.warning(f"Image {tag} not found for download")
        return None


@require_docker
def remove_image(tag: str) -> bool:
    try:
        _get_client().images.remove(tag, force=True)
        logger.debug(f"Removed image {tag}")
        return True
    except ImageNotFound:
        logger.debug(f"Image {tag} not found, already removed")
        return False


@require_docker
def iter_push_chunks(
    tag: str,
    target_tag: str,
    repository: str,
    username: str,
    password: str,
) -> Iterator[dict]:
    client = _get_client()

    image = client.images.get(tag)

    image.tag(repository, tag=target_tag)

    try:
        resp = client.api.push(
            repository=repository,
            tag=target_tag,
            stream=True,
            decode=True,
            auth_config={
                "username": username,
                "password": password,
            },
        )
        yield from resp
    finally:
        # Always clean up the re-tag to avoid polluting the local image store.
        try:
            client.images.remove(f"{repository}:{target_tag}", force=True)
        except Exception as e:
            logger.warning(
                f"Failed to remove re-tagged image {repository}:{target_tag}: {e}"
            )
