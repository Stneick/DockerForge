import math
from uuid import UUID

from app.models.build import Build as BuildModel
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
        status="pending",
        image_tag=data.image_tag,
        dockerfile_content=dockerfile_content,
        dockerignore_content=dockerignore_content,
        trigger_type="manual",
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
            "env_vars": data.env_vars if data.env_vars else project.env_vars,
            "port": project.port,
        },
    )
    db.add(new_build)
    await db.commit()
    await db.refresh(new_build)

    request_data = data.model_dump()

    arq_pool = request.app.state.arq_pool
    await arq_pool.enqueue_job(
        "run_build_task",  # name of the function in worker.py
        new_build.id,
        request_data,
    )

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
