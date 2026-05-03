import asyncio
import json
import math
from datetime import UTC, datetime
from uuid import UUID

import redis.asyncio as redis_async
from app.core.utils import format_size_diff
from app.models.build import Build as BuildModel
from app.models.build import BuildStatusEnum, TriggerTypeEnum
from app.models.project import Project as ProjectModel
from app.models.settings import AppSettings as AppSettingsModel
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
from app.services.docker_client import remove_image, save_image
from fastapi import HTTPException, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def _save_and_enqueue_build(
    new_build: BuildModel,
    project,
    request_data: dict,
    db: AsyncSession,
    request: Request,
) -> BuildModel:
    project.total_builds += 1
    project.last_build_at = datetime.now(UTC)

    db.add(new_build)
    await db.commit()
    await db.refresh(project)
    await db.refresh(new_build)

    try:
        arq_pool = request.app.state.arq_pool
        await arq_pool.enqueue_job("run_build_task", new_build.id, request_data)
    except Exception as e:
        logger.error(f"Failed to enqueue build {new_build.id}: {e}")
        new_build.status = BuildStatusEnum.failed
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Build queue unavailable. Please try again.",
        ) from e

    return new_build


async def trigger_build(
    project: ProjectModel,
    data: TriggerBuildRequest,
    db: AsyncSession,
    request: Request,
) -> BuildModel:
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

    return await _save_and_enqueue_build(
        new_build, project, data.model_dump(), db, request
    )


async def retry_build(
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
    request: Request,
) -> BuildModel:
    result = await db.execute(
        select(BuildModel).where(
            BuildModel.id == build_id,
            BuildModel.project_id == project.id,
        )
    )
    original_build = result.scalar_one_or_none()

    if not original_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    if original_build.status in (BuildStatusEnum.pending, BuildStatusEnum.building):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Build is currently running. Cancel it before retrying.",
        )

    new_build = BuildModel(
        project_id=project.id,
        status=BuildStatusEnum.pending,
        image_tag=original_build.image_tag,
        dockerfile_content=original_build.dockerfile_content,
        dockerignore_content=original_build.dockerignore_content,
        trigger_type=TriggerTypeEnum.retry,
        build_config=original_build.build_config,
    )

    original_config = original_build.build_config or {}
    request_data = {
        "build_args": original_config.get("build_args", []),
        "env_vars": original_config.get("env_vars", []),
        "no_cache": original_config.get("no_cache", False),
        "image_tag": original_build.image_tag,
        "custom_dockerfile": None,
        "custom_dockerignore": None,
    }

    return await _save_and_enqueue_build(new_build, project, request_data, db, request)


async def list_builds(
    project: ProjectModel,
    db: AsyncSession,
    page: int,
    per_page: int,
    status: str | None = None,
) -> BuildListResponse:
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
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
) -> BuildDetail:
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
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
) -> BuildLogsResponse:
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
    project: ProjectModel,
    build_id: UUID,
    request: Request,
    db: AsyncSession,
    redis: redis_async.Redis,
):
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
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
) -> StreamingResponse:
    build = await get_build_detail(project, build_id, db)
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
    project: ProjectModel,
    build_a_id: UUID,
    build_b_id: UUID,
    db: AsyncSession,
) -> BuildComparisonResponse:
    build_a = await get_build_detail(project, build_a_id, db)
    build_b = await get_build_detail(project, build_b_id, db)

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
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
    redis: redis_async.Redis,
    app_settings: AppSettingsModel,
) -> MessageResponse:
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
        ex=app_settings.build_timeout_seconds + 60,
    )

    if build.status == BuildStatusEnum.pending:
        message = "Build is queued; it will be cancelled before execution starts."
    else:
        message = "Cancel requested; build will stop shortly."

    return MessageResponse(message=message)


async def push_build_file(
    project: ProjectModel,
    build_id: UUID,
    target_tag: str,
    repository: str,
    username: str,
    password: str,
    db: AsyncSession,
    request: Request,
) -> MessageResponse:
    build = await get_build_detail(project, build_id, db)

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

    try:
        arq_pool = request.app.state.arq_pool
        await arq_pool.enqueue_job(
            "run_push_task",
            build.image_tag,
            target_tag,
            repository,
            username,
            password,
            build_id,
            _job_id=f"push:{build_id}",
        )
    except Exception as e:
        logger.error(f"Failed to enqueue push for build {build_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push queue unavailable. Please try again.",
        ) from e

    return MessageResponse(message="Push started")


async def stream_push_events(
    project: ProjectModel,
    build_id: UUID,
    request: Request,
    db: AsyncSession,
    redis: redis_async.Redis,
):
    result = await db.execute(
        select(BuildModel).where(
            BuildModel.id == build_id,
            BuildModel.project_id == project.id,
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
            try:
                response = await redis.xread({stream_key: last_id}, block=1000)
            except ConnectionError as e:
                logger.error(
                    f"Redis connection lost during push stream for build {build_id}: {e}"
                )
                error_payload = json.dumps(
                    {
                        "status": "interrupted",
                        "message": "Live push stream interrupted. The push may still be running in the background. Check back later.",
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
                    if "dockerforge_status" in parsed or "error" in parsed:
                        return

    return event_generator()


async def delete_build_image(
    project: ProjectModel,
    build_id: UUID,
    db: AsyncSession,
) -> MessageResponse:
    result = await db.execute(
        select(BuildModel).where(
            BuildModel.id == build_id,
            BuildModel.project_id == project.id,
        )
    )
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Build not found"
        )

    if build.status != BuildStatusEnum.success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only images from successful builds can be deleted",
        )

    if build.image_cleaned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Build image has already been cleaned up",
        )

    if not build.image_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Build has no image tag",
        )

    await asyncio.to_thread(remove_image, build.image_tag)
    build.image_cleaned_at = datetime.now(UTC)
    await db.commit()

    return MessageResponse(message="Build image deleted")
