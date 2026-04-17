from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.build import Build
    from app.models.user import User


class LanguageEnum(str, enum.Enum):
    python = "python"
    node = "node"
    go = "go"
    java = "java"
    c = "c"
    cpp = "cpp"
    rust = "rust"


class SourceTypeEnum(str, enum.Enum):
    upload = "upload"
    git = "git"
    none = "none"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[LanguageEnum | None] = mapped_column(
        Enum(LanguageEnum), nullable=True
    )
    dependency_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    startup_command: Mapped[str | None] = mapped_column(String(500), nullable=True)
    framework: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entry_point: Mapped[str | None] = mapped_column(String(255), nullable=True)
    binary_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    build_output_dir: Mapped[str | None] = mapped_column(String(255), nullable=True)
    build_package: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    env_vars: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_type: Mapped[SourceTypeEnum] = mapped_column(
        Enum(SourceTypeEnum), default=SourceTypeEnum.none, nullable=False
    )
    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_uploaded: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="projects")
    builds: Mapped[list[Build]] = relationship(
        "Build", back_populates="project", cascade="all, delete-orphan"
    )
    total_builds: Mapped[int] = mapped_column(
        default=0, server_default="0", nullable=False
    )
    last_build_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
