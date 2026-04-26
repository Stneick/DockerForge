import asyncio
import json
import re
import shutil
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from arq import cron
from arq.connections import RedisSettings
from docker.errors import BuildError
from loguru import logger
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.build import Build as BuildModel
from app.models.build import BuildStatusEnum
from app.models.project import Project as ProjectModel
from app.schemas.build import LogEntry, StreamEvent, TriggerBuildRequest
from app.services.docker_client import (
    BuildCancelled,
    build_image,
    get_image_layers,
    get_image_size,
    prune_managed_dangling_images,
    remove_image,
)


def _slugify_project_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9_.-]+", "-", name.lower())
    slug = re.sub(r"-+", "-", slug).strip("-._")
    return slug


async def run_build_task(ctx: dict, build_id: UUID, request_data: dict) -> str:

    redis = ctx["redis"]
    logger.info(f"Starting background build for {build_id}")
    logs = []

    data = TriggerBuildRequest.model_validate(request_data)

    async with async_session() as db:
        query = select(BuildModel).where(BuildModel.id == build_id)
        result = await db.execute(query)
        build_record = result.scalars().first()

        if not build_record:
            logger.error(f"Build {build_id} not found in database.")
            return "Build not found"

        try:
            if await redis.exists(f"build:{build_id}:cancel"):
                raise BuildCancelled()

            build_record.status = BuildStatusEnum.building
            build_record.started_at = datetime.now(UTC)
            await db.commit()

            project_query = select(ProjectModel).where(
                ProjectModel.id == build_record.project_id
            )
            project_result = await db.execute(project_query)
            project_record = project_result.scalars().first()

            if not project_record:
                logger.error(f"Project for build {build_id} not found in database.")
                raise FileNotFoundError(
                    f"Project for build {build_id} not found in database."
                )

            source_dir = (
                Path(settings.PROJECTS_SOURCE_DIR) / str(project_record.id) / "source"
            )

            if not source_dir.exists():
                raise FileNotFoundError(
                    f"Project source directory not found: {source_dir}"
                )

            allowed_root = source_dir.resolve()
            children = list(source_dir.iterdir())
            if len(children) == 1 and children[0].is_dir():
                candidate = children[0].resolve()
                if not candidate.is_relative_to(allowed_root):
                    logger.error(
                        f"Symlink escape blocked for build {build_id}: "
                        f"{children[0]} -> {candidate} (root: {allowed_root})"
                    )
                    raise ValueError("Invalid project source.")
                source_dir = candidate

            formatted_build_args = {}
            if data.build_args:
                for arg in data.build_args:
                    formatted_build_args[arg.key] = arg.value

            raw_tag = (build_record.image_tag or "").strip()
            build_id_short = str(build_id).replace("-", "")[:8]

            if not raw_tag or raw_tag.lower() == "none":
                repo = (
                    _slugify_project_name(project_record.name)
                    or f"project-{project_record.id}"
                )
            else:
                repo = raw_tag.split(":")[0]

            clean_tag = f"{repo}:b-{build_id_short}"

            # Isolate build context per build
            with tempfile.TemporaryDirectory(prefix=f"build-{build_id}-") as staging:
                staging_dir = Path(staging)
                await asyncio.to_thread(
                    shutil.copytree,
                    source_dir,
                    staging_dir,
                    symlinks=False,
                    dirs_exist_ok=True,
                )

                image_id, log_lines = await asyncio.to_thread(
                    build_image,
                    source_dir=str(staging_dir),
                    dockerfile_content=build_record.dockerfile_content,
                    dockerignore_content=build_record.dockerignore_content,
                    tag=clean_tag,
                    build_args=formatted_build_args,
                    no_cache=data.no_cache,
                    build_id=build_id,
                )
                logs.extend(log_lines)

            image_size = await asyncio.to_thread(get_image_size, image_id)
            image_layers = await asyncio.to_thread(get_image_layers, image_id)

            build_record.status = BuildStatusEnum.success
            build_record.image_tag = clean_tag
            build_record.image_size_bytes = image_size
            build_record.layers = image_layers
            logger.success(
                f"Build {build_id} completed successfully, image_tag={clean_tag}"
            )

        except BuildCancelled as e:
            build_record.status = BuildStatusEnum.cancelled
            logger.info(f"Build {build_id} cancelled by user")
            if e.build_log:
                logs.extend(e.build_log)
            else:
                cancel_now = datetime.now(UTC)
                cancel_msg = "Build cancelled by user"
                logs.append(
                    {
                        "line": len(logs) + 1,
                        "message": cancel_msg,
                        "stream": "stderr",
                        "timestamp": cancel_now.isoformat(),
                    }
                )
                try:
                    log_entry = LogEntry(
                        line=len(logs),
                        message=cancel_msg,
                        stream="stderr",
                        timestamp=cancel_now,
                    )
                    event = StreamEvent(status="cancelled", log=log_entry)
                    await redis.xadd(
                        f"build:{build_id}",
                        {"payload": event.model_dump_json()},
                        maxlen=settings.BUILD_LOG_STREAM_MAX_ENTRIES,
                        approximate=True,
                    )
                except Exception as pub_err:
                    logger.debug(
                        f"Failed to publish pre-start cancel log for {build_id}: {pub_err}"
                    )

        except BuildError as e:
            build_record.status = BuildStatusEnum.failed
            logger.warning(f"Build {build_id} failed: {e}")
            if e.build_log:
                logs.extend(e.build_log)

        except Exception as e:
            build_record.status = BuildStatusEnum.failed
            logger.error(f"Build {build_id} failed with unknown error: {e}")
            logs.append(
                {
                    "line": len(logs) + 1,  # add it to the end
                    "message": f"FATAL ERROR: {str(e)}",
                    "stream": "stderr",
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            )

        finally:
            try:
                await redis.delete(f"build:{build_id}:cancel")
            except Exception as cancel_del_err:
                logger.debug(
                    f"Failed to delete cancel flag for build {build_id}: {cancel_del_err}"
                )

            build_record.finished_at = datetime.now(UTC)
            if build_record.started_at:
                duration = build_record.finished_at - build_record.started_at
                build_record.duration_seconds = duration.total_seconds()

            build_record.logs = logs
            db.add(build_record)

            final_status = build_record.status

            try:
                await db.commit()
            except Exception as commit_err:
                logger.error(
                    f"Failed to persist final state for build {build_id}: {commit_err}"
                )

            try:
                final_payload = json.dumps(
                    {
                        "status": final_status,
                        "log": f"--- Build finished with status: {final_status.upper()} ---",
                    }
                )
                await redis.xadd(f"build:{build_id}", {"payload": final_payload})
                await redis.expire(
                    f"build:{build_id}", settings.BUILD_LOG_STREAM_TTL_SECONDS
                )
            except Exception as pub_err:
                logger.error(
                    f"Failed to publish final status for build {build_id}: {pub_err}"
                )

            logger.info(
                f"Background build {build_id} finished with status: {final_status}"
            )

        if final_status == BuildStatusEnum.success:
            try:
                await redis.enqueue_job(
                    "cleanup_image_task",
                    clean_tag,
                    build_id,
                    _defer_by=timedelta(seconds=settings.IMAGE_TTL_SECONDS),
                )
            except Exception as enqueue_err:
                logger.warning(
                    f"Failed to schedule TTL cleanup for build_id={build_id} image_tag={clean_tag}: {enqueue_err}. "
                )

        return f"Build {build_id} finished with status: {final_status}"


async def cleanup_image_task(ctx: dict, tag: str, build_id: UUID) -> str:
    try:
        removed = await asyncio.to_thread(remove_image, tag)
    except Exception as err:
        logger.warning(
            f"TTL cleanup: Docker failed to remove image, build_id={build_id} image_tag={tag}: {err}"
        )
        return f"failed to clean {tag}"

    if removed:
        logger.info(f"TTL cleanup: removed image, build_id={build_id} image_tag={tag}")
    else:
        logger.debug(
            f"TTL cleanup: image already gone, build_id={build_id} image_tag={tag}"
        )

    async with async_session() as db:
        result = await db.execute(select(BuildModel).where(BuildModel.id == build_id))
        build = result.scalars().first()
        if build:
            build.image_cleaned_at = datetime.now(UTC)
            await db.commit()
        else:
            logger.warning(
                f"TTL cleanup: build not found for image_cleaned_at update, build_id={build_id} image_tag={tag}"
            )

    return f"cleaned {tag}"


async def prune_managed_images_task(ctx: dict) -> str:
    result = await asyncio.to_thread(prune_managed_dangling_images, "10m")
    deleted = result.get("images_deleted", 0)
    reclaimed = result.get("space_reclaimed", 0)
    if deleted:
        logger.info(
            f"Periodic prune: removed {deleted} dangling image(s), "
            f"reclaimed {reclaimed} bytes"
        )
    else:
        logger.debug("Periodic prune: nothing to clean up")
    return f"pruned {deleted} images, reclaimed {reclaimed} bytes"


# ARQ Configuration
class WorkerSettings:
    functions = [run_build_task, cleanup_image_task]
    cron_jobs = [
        cron(prune_managed_images_task, minute={0, 15, 30, 45}),
    ]
    redis_settings = RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT)
    max_jobs = settings.BUILD_MAX_CONCURRENT
    job_timeout = settings.BUILD_TIMEOUT_SECONDS + 60  # buffer for cleanup
    max_tries = 1
    keep_result = 0
    allow_abort_jobs = True
