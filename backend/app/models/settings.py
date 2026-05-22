from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

if TYPE_CHECKING:
    from docker.api.build import _ContainerLimits


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Build
    build_timeout_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=600
    )
    build_memory_limit: Mapped[str] = mapped_column(
        String(16), nullable=False, default="512m"
    )

    # Image lifecycle
    image_cleanup_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    image_ttl_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3600
    )

    # Uploads / clones
    max_upload_size_mb: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100
    )
    git_clone_timeout_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=120
    )

    # Logs
    build_log_stream_ttl_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=300
    )
    build_log_stream_max_entries: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10000
    )

    # Linting
    hadolint_timeout_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (CheckConstraint("id = 1", name="singleton_row"),)

    def _parse_memory(self, mem_str: str) -> int:
        units = {"k": 1024, "m": 1024**2, "g": 1024**3}
        return int(mem_str[:-1]) * units[mem_str[-1].lower()]

    @property
    def container_limits(self) -> "_ContainerLimits":
        mem = self._parse_memory(self.build_memory_limit)
        return {"memory": mem, "memswap": mem}
