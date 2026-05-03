"""add app_settings table

Revision ID: f3a8c91d0b2e
Revises: 98d1a40eea0f
Create Date: 2026-05-26 20:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f3a8c91d0b2e"
down_revision: Union[str, None] = "98d1a40eea0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("build_timeout_seconds", sa.Integer(), nullable=False, server_default="600"),
        sa.Column("build_memory_limit", sa.String(length=16), nullable=False, server_default="512m"),
        sa.Column("image_cleanup_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("image_ttl_seconds", sa.Integer(), nullable=False, server_default="3600"),
        sa.Column("max_upload_size_mb", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("git_clone_timeout_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("build_log_stream_ttl_seconds", sa.Integer(), nullable=False, server_default="300"),
        sa.Column("build_log_stream_max_entries", sa.Integer(), nullable=False, server_default="10000"),
        sa.Column("hadolint_timeout_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="singleton_row"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the singleton row with defaults
    op.execute(
        "INSERT INTO app_settings (id) VALUES (1)"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
