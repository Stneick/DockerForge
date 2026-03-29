import math
from uuid import UUID

from app.models.project import Project as ProjectModel
from app.models.user import User
from app.schemas.common import MessageResponse, Pagination
from app.schemas.project import (
    CreateProjectRequest,
    Project,
    ProjectListResponse,
    UpdateProjectRequest,
)
from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def _get_project_or_404(
    project_id: UUID, user: User, db: AsyncSession
) -> ProjectModel:
    result = await db.execute(select(ProjectModel).where(ProjectModel.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    if project.user_id != user.id:
        logger.warning(
            f"User {user.id} attempted to access project {project_id} owned by {project.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def create_project(
    data: CreateProjectRequest, user: User, db: AsyncSession
) -> Project:
    new_project = ProjectModel(
        user_id=user.id, name=data.name, description=data.description
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return Project.model_validate(new_project)


async def list_projects(
    user: User,
    db: AsyncSession,
    page: int,
    per_page: int,
    sort_by: str,
    order: str,
) -> ProjectListResponse:
    sort_col = getattr(ProjectModel, sort_by)
    sort_clause = sort_col.asc() if order == "asc" else sort_col.desc()

    count_query = (
        select(func.count())
        .select_from(ProjectModel)
        .where(ProjectModel.user_id == user.id)
    )
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page
    rows_query = (
        select(ProjectModel)
        .where(ProjectModel.user_id == user.id)
        .order_by(sort_clause)
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(rows_query)
    projects = result.scalars().all()

    total_pages = math.ceil(total / per_page) if per_page else 0

    return ProjectListResponse(
        items=[Project.model_validate(p) for p in projects],
        pagination=Pagination(
            page=page,
            per_page=per_page,
            total_items=total,
            total_pages=total_pages,
        ),
    )


async def get_project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    project = await _get_project_or_404(project_id, user, db)
    return Project.model_validate(project)


async def update_project(
    project_id: UUID, data: UpdateProjectRequest, user: User, db: AsyncSession
) -> Project:
    project = await _get_project_or_404(project_id, user, db)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return Project.model_validate(project)


async def delete_project(
    project_id: UUID, user: User, db: AsyncSession
) -> MessageResponse:
    project = await _get_project_or_404(project_id, user, db)
    await db.delete(project)
    await db.commit()
    return MessageResponse(message="Project deleted")
