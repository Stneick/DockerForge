from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import Pagination, SupportedLanguage


class EnvVar(BaseModel):
    key: str
    value: str


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not 1 <= len(v) <= 100:
            raise ValueError("Project name must be between 1 and 100 characters long")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None and not 1 <= len(v) <= 500:
            raise ValueError(
                "Project description must be between 1 and 500 characters long"
            )
        return v


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    language: SupportedLanguage | None = None
    framework: str | None = None
    dependency_file: str | None = None
    startup_command: str | None = None
    entry_point: str | None = None
    binary_name: str | None = None
    build_output_dir: str | None = None
    env_vars: list[EnvVar] | None = None
    port: int | None = None


class Project(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    description: str | None
    language: SupportedLanguage | None
    dependency_file: str | None
    startup_command: str | None
    framework: str | None = None
    entry_point: str | None = None
    binary_name: str | None = None
    build_output_dir: str | None = None
    env_vars: list[EnvVar] = []
    port: int | None
    source_type: str  # "upload" | "git" | "none"
    repo_url: str | None
    source_uploaded: bool
    total_builds: int = 0
    last_build_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("env_vars", mode="before")
    @classmethod
    def coerce_env_vars(cls, v: object) -> object:
        return v if v is not None else []


class ProjectListResponse(BaseModel):
    items: list[Project]
    pagination: Pagination


class SourceAnalysisResponse(BaseModel):
    detected_language: SupportedLanguage | None = None
    detected_framework: str | None = None
    confidence: float = 0.0
    detected_dependency_file: str | None = None
    suggested_startup_command: str | None = None
    detected_entry_point: str | None = None
    detected_binary_name: str | None = None
    detected_build_output_dir: str | None = None
    detected_port: int | None = None
    detected_files: list[str] = []
    has_existing_dockerfile: bool = False
    note: str | None = None
    warnings: list[str] = []


class CloneRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    access_token: str | None = None


class DockerfileOverrides(BaseModel):
    base_image: str | None = None
    language: SupportedLanguage | None = None
    framework: str | None = None
    dependency_file: str | None = None
    startup_command: str | None = None
    entry_point: str | None = None
    binary_name: str | None = None
    build_output_dir: str | None = None
    port: int | None = None
    env_vars: list[EnvVar] | None = None


class DockerfilePreviewResponse(BaseModel):
    dockerfile_content: str
    base_image: str
    estimated_layers: int
    warnings: list[str]
