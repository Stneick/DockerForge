import asyncio
import json
import math
import threading
from datetime import UTC, datetime
from uuid import UUID

import redis.asyncio as redis_async
from app.config import settings
from app.core.utils import format_size_diff
from app.models.build import Build as BuildModel
from app.models.build import BuildStatusEnum, TriggerTypeEnum
from app.models.user import User
from app.schemas.build import Build as BuildSchema
from app.schemas.build import (
    BuildComparisonResponse,
    BuildDetail,
    BuildListResponse,
    BuildLogsResponse,
    LogEntry,
    TriggerBuildRequest,
)
from app.schemas.common import MessageResponse, Pagination
from app.schemas.project import Project as ProjectSchema
from app.services import dockerfile_generator
from app.services.docker_client import iter_push_chunks, save_image
from app.services.project_service import _get_project_or_404
from docker.errors import APIError as DockerAPIError
from docker.errors import ImageNotFound
from fastapi import HTTPException, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def trigger_build(
    project_id: UUID,
    data: TriggerBuildRequest,
    current_user: User,
    db: AsyncSession,
    request: Request,
) -> BuildModel:
    project = await _get_project_or_404(project_id, current_user, db)

    if data.custom_dockerfile:
        dockerfile_content = data.custom_dockerfile
    else:
        dockerfile_content = dockerfile_generator.generate_dockerfile(
            ProjectSchema.model_validate(project)
        )
    if data.custom_dockerignore:
        dockerignore_content = data.custom_dockerignore
    else:
        lang_str = project.language.value if project.language else ""
        dockerignore_content = dockerfile_generator.generate_dockerignore(lang_str)

    new_build = BuildModel(
        project_id=project.id,
        status=BuildStatusEnum.pending,
        image_tag=data.image_tag,
        dockerfile_content=dockerfile_content,
        dockerignore_content=dockerignore_content,
        trigger_type=TriggerTypeEnum.manual,
        build_config={
            "language": project.language.value if project.language else None,
            "dependency_file": project.dependency_file,
            "startup_command": project.startup_command,
            "framework": project.framework,
            "entry_point": project.entry_point,
            "binary_name": project.binary_name,
            "build_output_dir": project.build_output_dir,
            "build_package": project.build_package,
            "base_image": project.base_image,
            "env_vars": (
                [v.model_dump() for v in data.env_vars]
                if data.env_vars
                else (project.env_vars or [])
            ),
            "port": project.port,
            "build_args": [a.model_dump() for a in (data.build_args or [])],
            "no_cache": data.no_cache,
        },
    )
    project.total_builds += 1
    project.last_build_at = datetime.now(UTC)

    db.add(new_build)
    await db.commit()
    await db.refresh(project)
    await db.refresh(new_build)

    request_data = data.model_dump()

    try:
        arq_pool = request.app.state.arq_pool
        await arq_pool.enqueue_job(
            "run_build_task",  # name of the function in worker.py
            new_build.id,
            request_data,
        )
    except Exception as e:
        logger.error(f"Failed to enqueue build {new_build.id}: {e}")
        new_build.status = BuildStatusEnum.failed
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Build queue unavailable. Please try again.",
        ) from e

    return new_build


async def list_builds(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    page: int,
    per_page: int,
    status: str | None = None,
) -> BuildListResponse:
    project = await _get_project_or_404(project_id, user, db)

    conditions = [
        BuildModel.project_id == project.id,
    ]
    if status is not None:
        conditions.append(BuildModel.status == status)

    count_query = select(func.count()).select_from(BuildModel).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page

    rows_query = (
        select(BuildModel)
        .where(*conditions)
        .order_by(
            BuildModel.created_at.desc()
        )  # order by still needed for stable pagination
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(rows_query)
    builds = result.scalars().all()

    total_pages = math.ceil(total / per_page) if per_page else 0

    return BuildListResponse(
        items=[BuildSchema.model_validate(p) for p in builds],
        pagination=Pagination(
            page=page,
            per_page=per_page,
            total_items=total,
            total_pages=total_pages,
        ),
    )


async def get_build_detail(
    project_id: UUID,
    build_id: UUID,
    user: User,
    db: AsyncSession,
) -> BuildDetail:
    project = await _get_project_or_404(project_id, user, db)

    query = select(BuildModel).where(
        BuildModel.id == build_id,
        BuildModel.project_id == project.id,
    )
    result = await db.execute(query)
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    return BuildDetail.model_validate(build)


async def get_build_logs(
    project_id: UUID,
    build_id: UUID,
    user: User,
    db: AsyncSession,
) -> BuildLogsResponse:
    project = await _get_project_or_404(project_id, user, db)

    query = select(BuildModel).where(
        BuildModel.id == build_id,
        BuildModel.project_id == project.id,
    )
    result = await db.execute(query)
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    if build.status in (BuildStatusEnum.pending, BuildStatusEnum.building):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Build is still in progress. Use the /events endpoint to stream live logs.",
        )

    raw_logs = build.logs or []
    log_entries = [LogEntry(**entry) for entry in raw_logs]

    return BuildLogsResponse(
        build_id=build.id,
        status=build.status,
        logs=log_entries,
    )


async def stream_build_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    user: User,
    db: AsyncSession,
    redis: redis_async.Redis,
):
    project = await _get_project_or_404(project_id, user, db)

    query = select(BuildModel).where(
        BuildModel.id == build_id,
        BuildModel.project_id == project.id,
    )
    result = await db.execute(query)
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    if build.status in ["success", "failed", "cancelled"]:
        stream_exists = await redis.exists(f"build:{build_id}")
        if not stream_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="logs not found",
            )

    async def event_generator():
        stream_key = f"build:{build_id}"
        last_id = "0"
        while True:
            if await request.is_disconnected():
                break
            try:
                response = await redis.xread(
                    {stream_key: last_id}, block=1000
                )  # 1 second
            except ConnectionError as e:
                logger.error(
                    f"Redis connection lost during live stream for build {build_id}: {e}"
                )
                error_payload = json.dumps(
                    {
                        "status": "building",
                        "log": {
                            "line": 0,
                            "message": "Live log stream interrupted. The build is still running in the background. Check back later for final logs.",
                            "stream": "stderr",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                    }
                )
                yield f"data: {error_payload}\n\n"
                break
            if not response:
                continue

            for _stream_name, entries in response:
                for entry_id, fields in entries:
                    data_str = fields[b"payload"].decode("utf-8")
                    yield f"data: {data_str}\n\n"
                    last_id = entry_id
                    parsed = json.loads(data_str)
                    if parsed.get("status") in {"success", "failed", "cancelled"}:
                        return

    return event_generator()


async def download_build_file(
    project_id: UUID,
    build_id: UUID,
    user: User,
    db: AsyncSession,
) -> StreamingResponse:
    build = await get_build_detail(project_id, build_id, user, db)
    if build.status != BuildStatusEnum.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Build not successful",
        )
    if build.image_cleaned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Build has already been cleaned, please trigger a new build",
        )
    stream = await asyncio.to_thread(save_image, build.image_tag)
    if stream is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found in Docker",
        )
    assert build.image_tag is not None
    filename = build.image_tag.replace(":", "_") + ".tar"

    return StreamingResponse(
        stream,
        media_type="application/x-tar",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


async def get_build_comparison(
    project_id: UUID,
    build_a_id: UUID,
    build_b_id: UUID,
    user: User,
    db: AsyncSession,
) -> BuildComparisonResponse:
    build_a = await get_build_detail(project_id, build_a_id, user, db)
    build_b = await get_build_detail(project_id, build_b_id, user, db)

    if (
        build_a.status != BuildStatusEnum.success
        or build_b.status != BuildStatusEnum.success
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Builds must be successful",
        )

    size_a = build_a.image_size_bytes or 0
    size_b = build_b.image_size_bytes or 0
    size_diff = size_b - size_a

    # TODO: replace with LCS-based diff using difflib.SequenceMatcher
    # Currently matches by exact instruction string, so modified instructions appear
    # as separate "removed" + "added" instead of "changed".
    layers_a = {layer.instruction: layer for layer in (build_a.layers or [])}
    layers_b = {layer.instruction: layer for layer in (build_b.layers or [])}
    all_instructions = list(layers_a.keys()) + [
        k for k in layers_b if k not in layers_a
    ]
    layer_comparison = []
    for instruction in all_instructions:
        a = layers_a.get(instruction)
        b = layers_b.get(instruction)
        if a and b:
            diff_status = "changed" if a.size_bytes != b.size_bytes else "unchanged"
        elif b:
            diff_status = "added"
        else:
            diff_status = "removed"
        layer_comparison.append(
            {
                "instruction": instruction,
                "size_a": a.size_bytes if a else None,
                "size_b": b.size_bytes if b else None,
                "diff_bytes": (b.size_bytes if b else 0) - (a.size_bytes if a else 0),
                "status": diff_status,
            }
        )

    return BuildComparisonResponse(
        build_a=build_a,
        build_b=build_b,
        size_diff_bytes=size_diff,
        size_diff_human=format_size_diff(size_diff),
        duration_diff_seconds=round(
            (build_b.duration_seconds or 0) - (build_a.duration_seconds or 0), 2
        ),
        layer_comparison=layer_comparison,
    )


async def cancel_running_build(
    project_id: UUID,
    build_id: UUID,
    user: User,
    db: AsyncSession,
    redis: redis_async.Redis,
) -> MessageResponse:
    project = await _get_project_or_404(project_id, user, db)

    query = select(BuildModel).where(
        BuildModel.id == build_id,
        BuildModel.project_id == project.id,
    )
    result = await db.execute(query)
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    if build.status not in (BuildStatusEnum.pending, BuildStatusEnum.building):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Build is not in progress",
        )

    await redis.set(
        f"build:{build_id}:cancel",
        "1",
        ex=settings.BUILD_TIMEOUT_SECONDS + 60,
    )

    if build.status == BuildStatusEnum.pending:
        message = "Build is queued; it will be cancelled before execution starts."
    else:
        message = "Cancel requested; build will stop shortly."

    return MessageResponse(message=message)


# Strong references kept here so GC cannot collect tasks before they complete.
_active_push_tasks: set[asyncio.Task] = set()


async def _push_worker_task(
    image_tag: str,
    target_tag: str,
    repository: str,
    username: str,
    password: str,
    build_id: UUID,
    redis: redis_async.Redis,
) -> None:
    stream_key = f"push:{build_id}"
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[dict | None] = asyncio.Queue()

    def worker() -> None:
        try:
            for chunk in iter_push_chunks(
                image_tag, target_tag, repository, username, password
            ):
                loop.call_soon_threadsafe(q.put_nowait, chunk)
            loop.call_soon_threadsafe(
                q.put_nowait,
                {
                    "dockerforge_status": "success",
                    "repository": repository,
                    "tag": target_tag,
                },
            )
        except ImageNotFound:
            loop.call_soon_threadsafe(
                q.put_nowait,
                {
                    "dockerforge_status": "error",
                    "message": "Docker image not found locally; it may have been cleaned up",
                },
            )
        except DockerAPIError as err:
            explanation = getattr(err, "explanation", None) or str(err)
            loop.call_soon_threadsafe(
                q.put_nowait,
                {
                    "dockerforge_status": "error",
                    "message": f"Registry push failed: {explanation}",
                },
            )
        except Exception as err:
            loop.call_soon_threadsafe(
                q.put_nowait,
                {"dockerforge_status": "error", "message": str(err)},
            )
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)  # sentinel

    threading.Thread(target=worker, daemon=True).start()

    try:
        while True:
            chunk = await q.get()

            if chunk is None:
                break

            if "error" in chunk:
                logger.error(f"[push:{build_id}] {chunk['error']}")
            elif "status" in chunk:
                logger.debug(
                    f"[push:{build_id}] {chunk.get('status', '')} {chunk.get('id', '')}".strip()
                )

            await redis.xadd(
                stream_key,
                {"payload": json.dumps(chunk)},
                maxlen=settings.BUILD_LOG_STREAM_MAX_ENTRIES,
                approximate=True,
            )

            if "dockerforge_status" in chunk or "error" in chunk:
                await redis.expire(stream_key, 3600)
                break
    except Exception as err:
        logger.error(f"Push worker task crashed for build {build_id}: {err}")


async def push_build_file(
    project_id: UUID,
    build_id: UUID,
    target_tag: str,
    repository: str,
    username: str,
    password: str,
    user: User,
    db: AsyncSession,
    redis: redis_async.Redis,
) -> MessageResponse:
    build = await get_build_detail(project_id, build_id, user, db)

    if build.status != BuildStatusEnum.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only successful builds can be pushed",
        )
    if build.image_cleaned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Build image has already been cleaned up; trigger a new build first",
        )
    if not build.image_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Build has no image tag",
        )

    task = asyncio.create_task(
        _push_worker_task(
            build.image_tag, target_tag, repository, username, password, build_id, redis
        )
    )
    _active_push_tasks.add(task)
    task.add_done_callback(_active_push_tasks.discard)

    return MessageResponse(message="Push started")


async def stream_push_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    user: User,
    db: AsyncSession,
    redis: redis_async.Redis,
):
    await _get_project_or_404(project_id, user, db)

    result = await db.execute(
        select(BuildModel).where(
            BuildModel.id == build_id,
            BuildModel.project_id == project_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    async def event_generator():
        stream_key = f"push:{build_id}"
        last_id = "0"
        while True:
            if await request.is_disconnected():
                break
            response = await redis.xread({stream_key: last_id}, block=1000)
            if not response:
                continue
            for _stream_name, entries in response:
                for entry_id, fields in entries:
                    data_str = fields[b"payload"].decode("utf-8")
                    yield f"data: {data_str}\n\n"
                    last_id = entry_id
                    parsed = json.loads(data_str)
                    if "dockerforge_status" in parsed or "error" in parsed:
                        return

    return event_generator()
