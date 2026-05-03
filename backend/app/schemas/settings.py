import re
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from docker.api.build import _ContainerLimits


class AppSettings(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    build_timeout_seconds: int
    build_memory_limit: str
    image_cleanup_enabled: bool
    image_ttl_seconds: int
    max_upload_size_mb: int
    git_clone_timeout_seconds: int
    build_log_stream_ttl_seconds: int
    build_log_stream_max_entries: int
    hadolint_timeout_seconds: int
    updated_at: datetime

    def parse_memory(self, mem_str: str) -> int:
        units = {"k": 1024, "m": 1024**2, "g": 1024**3}
        return int(mem_str[:-1]) * units[mem_str[-1].lower()]

    @property
    def container_limits(self) -> "_ContainerLimits":
        mem = self.parse_memory(self.build_memory_limit)
        return {
            "memory": mem,
            "memswap": mem,
        }


class UpdateAppSettingsRequest(BaseModel):
    build_timeout_seconds: int | None = Field(default=None, ge=30, le=7200)
    build_memory_limit: str | None = None
    image_cleanup_enabled: bool | None = None
    image_ttl_seconds: int | None = Field(default=None, ge=60, le=86400)
    max_upload_size_mb: int | None = Field(default=None, ge=1, le=2048)
    git_clone_timeout_seconds: int | None = Field(default=None, ge=10, le=3600)
    build_log_stream_ttl_seconds: int | None = Field(default=None, ge=60, le=86400)
    build_log_stream_max_entries: int | None = Field(default=None, ge=100, le=100000)
    hadolint_timeout_seconds: int | None = Field(default=None, ge=5, le=300)

    @field_validator("build_memory_limit")
    @classmethod
    def validate_memory(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^\d+(k|m|g)$", v.lower()):
            raise ValueError("build_memory_limit must be like '512m', '1g', or '128k'")
        return v.lower()
