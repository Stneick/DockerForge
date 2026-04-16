from typing import Literal
from uuid import UUID

from app.core.dependencies import get_current_user, get_db
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
    stream_build_events,
    trigger_build,
)
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
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
async def build_events(
    project_id: UUID,
    build_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    generator = await stream_build_events(
        project_id, build_id, request, current_user, db
    )

    return StreamingResponse(generator, media_type="text/event-stream")
