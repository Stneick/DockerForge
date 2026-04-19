import asyncio
import json
import re
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from arq.connections import RedisSettings
from docker.errors import BuildError
from loguru import logger
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.build import Build as BuildModel
from app.models.build import BuildStatusEnum
from app.models.project import Project as ProjectModel
from app.schemas.build import TriggerBuildRequest
from app.services.docker_client import build_image, get_image_layers, get_image_size


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
            return "Project not found"

        source_dir = (
            Path(settings.PROJECTS_SOURCE_DIR) / str(project_record.id) / "source"
        )

        try:
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
            if not raw_tag or raw_tag.lower() == "none":
                clean_tag = (
                    _slugify_project_name(project_record.name)
                    or f"project-{project_record.id}"
                )
            else:
                clean_tag = raw_tag

            if ":" not in clean_tag:
                clean_tag = f"{clean_tag}:latest"

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
            build_record.image_size_bytes = image_size
            build_record.layers = image_layers
            logger.success(f"Build {build_id} completed successfully")

        except BuildError as e:
            build_record.status = BuildStatusEnum.failed
            logger.error(f"Build {build_id} failed: {e}")
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
                await redis.publish(f"build:{build_id}", final_payload)
            except Exception as pub_err:
                logger.error(
                    f"Failed to publish final status for build {build_id}: {pub_err}"
                )

            logger.info(
                f"Background build {build_id} finished with status: {final_status}"
            )

        return f"Build {build_id} finished with status: {final_status}"


# ARQ Configuration
class WorkerSettings:
    functions = [run_build_task]
    redis_settings = RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT)
    max_jobs = settings.BUILD_MAX_CONCURRENT
    job_timeout = settings.BUILD_TIMEOUT_SECONDS + 60  # buffer for cleanup
    max_tries = 1
    keep_result = 0
    allow_abort_jobs = True
