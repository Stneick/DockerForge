from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


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
