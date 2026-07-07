"""multi-key per provider — provider_keys table + backfill from providers.api_key

Revision ID: 009
Revises: 008
Create Date: 2026-06-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
import uuid

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provider_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(), nullable=False, server_default="default"),
        sa.Column("api_key", sa.String(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("rpm_limit", sa.Integer(), nullable=True),
        sa.Column("tpm_limit", sa.Integer(), nullable=True),
        sa.Column("daily_limit", sa.Integer(), nullable=True),
        sa.Column("rpm_remaining", sa.Integer(), nullable=True),
        sa.Column("tpm_remaining", sa.Integer(), nullable=True),
        sa.Column("daily_remaining", sa.Integer(), nullable=True),
        sa.Column("limit_reset_at", sa.DateTime(), nullable=True),
        sa.Column("cooldown_until", sa.DateTime(), nullable=True),
        sa.Column("requests_used", sa.Integer(), server_default="0"),
        sa.Column("tokens_used", sa.Integer(), server_default="0"),
        sa.Column("window_start", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Backfill: copy each provider's api_key into a provider_keys row.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, api_key FROM providers")).fetchall()
    for pid, api_key in rows:
        if api_key:
            conn.execute(
                sa.text(
                    "INSERT INTO provider_keys (id, provider_id, label, api_key) "
                    "VALUES (:id, :pid, 'default', :key)"
                ),
                {"id": str(uuid.uuid4()), "pid": str(pid), "key": api_key},
            )


def downgrade() -> None:
    op.drop_table("provider_keys")
