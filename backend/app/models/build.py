from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class BuildStatusEnum(str, enum.Enum):
    pending = "pending"
    building = "building"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class TriggerTypeEnum(str, enum.Enum):
    manual = "manual"
    retry = "retry"


class Build(Base):
    __tablename__ = "builds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[BuildStatusEnum] = mapped_column(
        Enum(BuildStatusEnum), default=BuildStatusEnum.pending, nullable=False
    )
    image_tag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dockerfile_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[TriggerTypeEnum] = mapped_column(
        Enum(TriggerTypeEnum), nullable=False
    )
    build_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    image_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    layers: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped[Project] = relationship("Project", back_populates="builds")
