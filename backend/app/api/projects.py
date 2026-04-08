from typing import Literal
from uuid import UUID

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.project import (
    CloneRequest,
    CreateProjectRequest,
    DockerfileOverrides,
    DockerfilePreviewResponse,
    Project,
    ProjectListResponse,
    SourceAnalysisResponse,
    UpdateProjectRequest,
)
from app.services.dockerfile_generator import generate_dockerfile
from app.services.project_service import (
    _get_project_or_404,
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)
from app.services.source_service import (
    clone_project_repo,
    redetect_project,
    upload_project_source,
)
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create(
    data: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_project(data, current_user, db)


@router.get("/", response_model=ProjectListResponse)
async def list_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    sort_by: Literal["created_at", "updated_at", "name"] = Query(default="updated_at"),
    order: Literal["asc", "desc"] = Query(default="desc"),
):
    return await list_projects(current_user, db, page, per_page, sort_by, order)


@router.get("/{project_id}", response_model=Project)
async def get_one(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_project(project_id, current_user, db)


@router.patch("/{project_id}", response_model=Project)
async def update(
    project_id: UUID,
    data: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_project(project_id, data, current_user, db)


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await delete_project(project_id, current_user, db)


@router.post("/{project_id}/upload", response_model=SourceAnalysisResponse)
async def upload_source(
    project_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await upload_project_source(project_id, file, current_user, db)


@router.post("/{project_id}/clone", response_model=SourceAnalysisResponse)
async def clone_source(
    project_id: UUID,
    data: CloneRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await clone_project_repo(project_id, data, current_user, db)


@router.post("/{project_id}/detect", response_model=SourceAnalysisResponse)
async def detect_source(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await redetect_project(project_id, current_user, db)


@router.post(
    "/{project_id}/dockerfile/preview", response_model=DockerfilePreviewResponse
)
async def preview_dockerfile(
    project_id: UUID,
    overrides: DockerfileOverrides | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, current_user, db)

    if overrides is None:
        overrides = DockerfileOverrides()

    language = overrides.language or project.language
    framework = overrides.framework or project.framework
    if language is None or framework is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language and framework must be set on the project or provided in overrides.",
        )

    try:
        dockerfile_content = generate_dockerfile(
            language=language.value if hasattr(language, "value") else language,
            framework=framework,
            dependency_file=overrides.dependency_file or project.dependency_file,
            startup_command=overrides.startup_command or project.startup_command,
            entry_point=overrides.entry_point or project.entry_point,
            binary_name=overrides.binary_name or project.binary_name,
            build_output_dir=overrides.build_output_dir or project.build_output_dir,
            port=overrides.port or project.port,
            env_vars=overrides.env_vars or project.env_vars,
            base_image=overrides.base_image,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e

    return DockerfilePreviewResponse(
        dockerfile_content=dockerfile_content,
        base_image=overrides.base_image or "default",
        estimated_layers=dockerfile_content.count("\n"),
        warnings=[],
    )
