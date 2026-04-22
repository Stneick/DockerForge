import asyncio
import json
import math
from datetime import UTC, datetime
from uuid import UUID

import redis.asyncio as redis_async
from app.models.build import Build as BuildModel
from app.models.build import BuildStatusEnum, TriggerTypeEnum
from app.models.user import User
from app.schemas.build import Build as BuildSchema
from app.schemas.build import (
    BuildDetail,
    BuildListResponse,
    BuildLogsResponse,
    LogEntry,
    TriggerBuildRequest,
)
from app.schemas.common import Pagination
from app.schemas.project import Project as ProjectSchema
from app.services import dockerfile_generator
from app.services.project_service import _get_project_or_404
from fastapi import HTTPException, Request, status
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
            "language": project.language,
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

    async def event_generator():
        pubsub = redis.pubsub()

        try:
            await pubsub.subscribe(f"build:{build_id}")

            # Replay: build may have finished before the request arrived or before subscribing
            await db.refresh(build)
            if build.status in ["success", "failed", "cancelled"]:
                for log in build.logs or []:
                    replay_payload = json.dumps({"status": "building", "log": log})
                    yield f"data: {replay_payload}\n\n"

                final_payload = json.dumps(
                    {
                        "status": build.status,
                        "log": {
                            "line": 0,
                            "message": f"--- Build finished with status: {build.status.upper()} ---",
                            "stream": "stdout",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                    }
                )
                yield f"data: {final_payload}\n\n"
                return

            # Replay any log lines already buffered, then tail pubsub for new ones
            buffered = await redis.lrange(f"logs:{build_id}", 0, -1)
            for raw in buffered:
                yield f"data: {raw.decode('utf-8')}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if message:
                        data_str = message["data"].decode("utf-8")
                        yield f"data: {data_str}\n\n"

                        parsed = json.loads(data_str)
                        if parsed.get("status") in {"success", "failed", "cancelled"}:
                            break

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

            await asyncio.sleep(0.1)

        finally:
            await pubsub.unsubscribe()
            await pubsub.aclose()

    return event_generator()
