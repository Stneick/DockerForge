import math
import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from app.schemas.common import Pagination
from app.schemas.project import EnvVar


class TriggerBuildRequest(BaseModel):
    custom_dockerfile: str | None = None
    custom_dockerignore: str | None = None
    image_tag: str | None = None
    env_vars: list[EnvVar] | None = None
    build_args: list[EnvVar] | None = None
    no_cache: bool = False

    @field_validator("image_tag")
    @classmethod
    def validate_docker_tag(cls, v: str | None) -> str | None:
        if not v:
            return v

        if len(v) > 255:
            raise ValueError("Docker image reference cannot exceed 255 characters.")

        docker_ref_pattern = re.compile(
            r"^[a-z0-9]+(?:(?:[._]|__|[-]*)[a-z0-9]+)*(?:/[a-z0-9]+(?:(?:[._]|__|[-]*)[a-z0-9]+)*)*"
            r"(?::[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127})?$"
        )

        if not docker_ref_pattern.match(v):
            raise ValueError(
                "Invalid Docker image format. The repository name must be entirely "
                "lowercase and use only letters, numbers, dashes, underscores, or periods."
            )

        return v


class Build(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    status: Literal["pending", "building", "success", "failed", "cancelled"]
    image_tag: str | None = None
    dockerfile_content: str | None = None
    dockerignore_content: str | None = None
    trigger_type: Literal["manual", "retry"]
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = None


class ImageLayer(BaseModel):
    instruction: str
    size_bytes: int
    size_human: str
    created_at: datetime | None = None


class BuildDetail(Build):
    image_size_bytes: int | None = None
    layers: list[ImageLayer] | None = None
    build_config: dict | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_size_human(self) -> str | None:
        if not self.image_size_bytes:
            return None
        size_bytes = self.image_size_bytes
        if size_bytes == 0:
            return "0 B"

        units = ("B", "KB", "MB", "GB", "TB")
        i = math.floor(math.log(size_bytes, 1024))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {units[i]}"


class BuildListResponse(BaseModel):
    items: list[Build]
    pagination: Pagination


class LogEntry(BaseModel):
    line: int
    message: str
    stream: Literal["stdout", "stderr"]
    timestamp: datetime


class BuildLogsResponse(BaseModel):
    build_id: UUID
    status: str
    logs: list[LogEntry]


class BuildComparisonResponse(BaseModel):
    build_a: BuildDetail
    build_b: BuildDetail
    size_diff_bytes: int  # positive = build_b is larger
    size_diff_human: str
    duration_diff_seconds: float
    layer_comparison: list[dict]  # {instruction, size_a, size_b, diff_bytes, status}


class StreamEvent(BaseModel):
    status: str
    log: LogEntry | None = None
