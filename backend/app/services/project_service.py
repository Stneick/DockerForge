import math
from pathlib import Path

from app.config import settings
from app.core.utils import force_rmtree
from app.models import Build
from app.models.build import BuildStatusEnum
from app.models.project import Project as ProjectModel
from app.models.user import User
from app.schemas.common import MessageResponse, Pagination
from app.schemas.project import (
    CacheStat,
    CreateProjectRequest,
    Project,
    ProjectListResponse,
    ProjectStats,
    UpdateProjectRequest,
)
from loguru import logger
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession


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


async def update_project(
    project: ProjectModel, data: UpdateProjectRequest, db: AsyncSession
) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return Project.model_validate(project)


async def delete_project(project: ProjectModel, db: AsyncSession) -> MessageResponse:
    source_dir = Path(settings.PROJECTS_SOURCE_DIR) / str(project.id)

    await db.delete(project)
    await db.commit()

    source_cleaned = True
    if source_dir.exists():
        try:
            force_rmtree(source_dir)
        except Exception:
            source_cleaned = False
            logger.exception(f"Failed to delete source files at {source_dir}")

    if source_cleaned:
        return MessageResponse(message="Project deleted")
    return MessageResponse(
        message="Project deleted, but its source files could not be removed; check server logs"
    )


async def get_project_stats(project: ProjectModel, db: AsyncSession) -> ProjectStats:
    stmt = select(
        func.count().label("total"),
        func.count(case((Build.status == BuildStatusEnum.success, 1))).label(
            "successful"
        ),
        func.count(case((Build.status == BuildStatusEnum.failed, 1))).label("failed"),
        func.count(case((Build.status == BuildStatusEnum.cancelled, 1))).label(
            "cancelled"
        ),
        func.avg(Build.duration_seconds).label("avg_duration"),
        func.min(Build.duration_seconds).label("fastest"),
        func.max(Build.duration_seconds).label("slowest"),
        func.avg(Build.image_size_bytes).label("avg_size"),
    ).where(Build.project_id == project.id)

    row = (await db.execute(stmt)).one()

    total = row.total or 0
    successful = row.successful or 0

    async def _cache_stat(no_cache_value: bool) -> CacheStat:
        r = (
            await db.execute(
                select(
                    func.count().label("build_count"),
                    func.avg(Build.duration_seconds).label("avg"),
                    func.min(Build.duration_seconds).label("min"),
                    func.max(Build.duration_seconds).label("max"),
                ).where(
                    Build.project_id == project.id,
                    Build.build_config["no_cache"].astext
                    == str(no_cache_value).lower(),
                )
            )
        ).one()
        return CacheStat(
            count=r.build_count,
            avg_duration_seconds=round(r.avg, 2) if r.avg is not None else None,
            min_duration_seconds=round(r.min, 2) if r.min is not None else None,
            max_duration_seconds=round(r.max, 2) if r.max is not None else None,
        )

    return ProjectStats(
        total_builds=total,
        successful_builds=successful,
        failed_builds=row.failed or 0,
        cancelled_builds=row.cancelled or 0,
        success_rate=round(successful / total, 4) if total > 0 else 0.0,
        avg_duration_seconds=(
            round(row.avg_duration, 2) if row.avg_duration is not None else None
        ),
        fastest_build_seconds=(
            round(row.fastest, 2) if row.fastest is not None else None
        ),
        slowest_build_seconds=(
            round(row.slowest, 2) if row.slowest is not None else None
        ),
        avg_image_size_bytes=int(row.avg_size) if row.avg_size is not None else None,
        last_build_at=project.last_build_at,
        cached_builds=await _cache_stat(False),
        no_cache_builds=await _cache_stat(True),
    )
