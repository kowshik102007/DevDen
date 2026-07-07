"""phase4 model catalog

Revision ID: 004
Revises: 003
Create Date: 2024-01-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "model_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_id", sa.String(), nullable=False),
        sa.Column("provider_name", sa.String(), nullable=False),
        # capability metadata
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("vision_support", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reasoning_support", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("coding_score", sa.Integer(), nullable=True),   # 1-10
        sa.Column("speed_score", sa.Integer(), nullable=True),    # 1-10
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider_id", "model_id", name="uq_user_provider_model"),
    )


def downgrade() -> None:
    op.drop_table("model_catalog")
