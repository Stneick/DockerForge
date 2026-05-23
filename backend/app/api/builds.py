from typing import Literal
from uuid import UUID

from app.core.dependencies import (
    get_app_settings,
    get_db,
    get_project,
    get_redis,
)
from app.models.project import Project as ProjectModel
from app.models.settings import AppSettings as AppSettingsModel
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


@router.post("", response_model=BuildSchema, status_code=status.HTTP_201_CREATED)
async def trigger(
    data: TriggerBuildRequest,
    request: Request,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await trigger_build(project, data, db, request)


@router.get("", response_model=BuildListResponse)
async def list_all(
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: (
        Literal["pending", "building", "success", "failed", "cancelled"] | None
    ) = Query(default=None),
):
    return await list_builds(project, db, page, per_page, status)


@router.get("/compare")
async def compare_builds(
    build_a_id: UUID = Query(..., description="First build ID"),
    build_b_id: UUID = Query(..., description="Second build ID"),
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_comparison(project, build_a_id, build_b_id, db)


@router.get("/{build_id}", response_model=BuildDetail)
async def get_build(
    build_id: UUID,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_detail(project, build_id, db)


@router.get("/{build_id}/logs", response_model=BuildLogsResponse)
async def get_logs(
    build_id: UUID,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await get_build_logs(project, build_id, db)


@router.get("/{build_id}/events")
async def build_events(
    build_id: UUID,
    request: Request,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    generator = await stream_build_events(project, build_id, request, db, redis)
    return StreamingResponse(generator, media_type="text/event-stream")


@router.get("/{build_id}/download")
async def download_build(
    build_id: UUID,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await download_build_file(project, build_id, db)


@router.post(
    "/{build_id}/push",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def push_build(
    build_id: UUID,
    data: PushBuildRequest,
    request: Request,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await push_build_file(
        project,
        build_id,
        data.target_tag,
        data.repository,
        data.username,
        data.password,
        db,
        request,
    )


@router.get("/{build_id}/push/events")
async def push_events(
    build_id: UUID,
    request: Request,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    generator = await stream_push_events(project, build_id, request, db, redis)
    return StreamingResponse(generator, media_type="text/event-stream")


@router.post(
    "/{build_id}/retry",
    response_model=BuildSchema,
    status_code=status.HTTP_201_CREATED,
)
async def retry(
    build_id: UUID,
    request: Request,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await retry_build(project, build_id, db, request)


@router.post(
    "/{build_id}/cancel",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cancel_build(
    build_id: UUID,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    app_settings: AppSettingsModel = Depends(get_app_settings),
):
    return await cancel_running_build(project, build_id, db, redis, app_settings)


@router.delete(
    "/{build_id}/image",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_build_image_route(
    build_id: UUID,
    project: ProjectModel = Depends(get_project),
    db: AsyncSession = Depends(get_db),
):
    return await delete_build_image(project, build_id, db)
