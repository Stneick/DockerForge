import asyncio
import json
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

import redis.asyncio as redis_async
from app.config import settings
from app.core.dependencies import get_current_user, get_db
from app.models.build import Build as BuildModel
from app.models.user import User
from app.schemas.build import (
    Build as BuildSchema,
)
from app.schemas.build import (
    BuildDetail,
    BuildListResponse,
    BuildLogsResponse,
    TriggerBuildRequest,
)
from app.services.build_service import (
    get_build_detail,
    get_build_logs,
    list_builds,
    trigger_build,
)
from app.services.project_service import _get_project_or_404
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/projects/{project_id}/builds", tags=["Builds"])


@router.post("/", response_model=BuildSchema, status_code=status.HTTP_201_CREATED)
async def trigger(
    project_id: UUID,
    data: TriggerBuildRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trigger_build(project_id, data, current_user, db, request)


@router.get("/", response_model=BuildListResponse)
async def list_all(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: (
        Literal["pending", "building", "success", "failed", "cancelled"] | None
    ) = Query(default=None),
):
    return await list_builds(project_id, current_user, db, page, per_page, status)


@router.get("/{build_id}", response_model=BuildDetail)
async def get_build(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_detail(project_id, build_id, current_user, db)


@router.get("/{build_id}/logs", response_model=BuildLogsResponse)
async def get_logs(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_logs(project_id, build_id, current_user, db)


@router.get("/{build_id}/events")
async def stream_build_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, current_user, db)

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
        if build.status in ["success", "failed", "cancelled"]:
            final_payload = json.dumps(
                {
                    "status": build.status,
                    "log": {
                        "line": 0,
                        "message": f"--- Build previously finished with status: {build.status.upper()} ---",
                        "stream": "stdout",
                        "timestamp": datetime.now(UTC).isoformat(),
                    },
                }
            )
            yield f"data: {final_payload}\n\n"
            return

        redis_client = redis_async.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT
        )
        pubsub = redis_client.pubsub()

        try:
            await pubsub.subscribe(f"build:{build_id}")

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

                        if (
                            '"status":"success"' in data_str
                            or '"status":"failed"' in data_str
                        ):
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
            await redis_client.aclose()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
