from typing import Literal
from uuid import UUID

from app.core.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.build import (
    Build as BuildSchema,
)
from app.schemas.build import (
    BuildDetail,
    BuildListResponse,
    BuildLogsResponse,
    PushBuildRequest,
    TriggerBuildRequest,
)
from app.schemas.common import MessageResponse
from app.services.build_service import (
    cancel_running_build,
    delete_build_image,
    download_build_file,
    get_build_comparison,
    get_build_detail,
    get_build_logs,
    list_builds,
    push_build_file,
    retry_build,
    stream_build_events,
    stream_push_events,
    trigger_build,
)
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
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


@router.get("/compare")
async def compare_builds(
    project_id: UUID,
    build_a_id: UUID = Query(..., description="First build ID"),
    build_b_id: UUID = Query(..., description="Second build ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_comparison(
        project_id, build_a_id, build_b_id, current_user, db
    )


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
async def build_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    generator = await stream_build_events(
        project_id, build_id, request, current_user, db, redis
    )

    return StreamingResponse(generator, media_type="text/event-stream")


@router.get("/{build_id}/download")
async def download_build(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await download_build_file(project_id, build_id, current_user, db)


@router.post(
    "/{build_id}/push",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def push_build(
    project_id: UUID,
    build_id: UUID,
    data: PushBuildRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await push_build_file(
        project_id,
        build_id,
        data.target_tag,
        data.repository,
        data.username,
        data.password,
        current_user,
        db,
        request,
    )


@router.get("/{build_id}/push/events")
async def push_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    generator = await stream_push_events(
        project_id, build_id, request, current_user, db, redis
    )
    return StreamingResponse(generator, media_type="text/event-stream")


@router.post(
    "/{build_id}/retry",
    response_model=BuildSchema,
    status_code=status.HTTP_201_CREATED,
)
async def retry(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await retry_build(project_id, build_id, current_user, db, request)


@router.post(
    "/{build_id}/cancel",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cancel_build(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    return await cancel_running_build(project_id, build_id, current_user, db, redis)


@router.delete(
    "/{build_id}/image",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_build_image_route(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await delete_build_image(project_id, build_id, current_user, db)
