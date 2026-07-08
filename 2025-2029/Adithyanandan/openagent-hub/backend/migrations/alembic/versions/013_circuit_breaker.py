"""Add circuit breaker and quota fields to providers

Revision ID: 013
Revises: 012
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"


def upgrade():
    op.add_column(
        "providers",
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "providers",
        sa.Column("circuit_state", sa.String(), nullable=False, server_default="closed"),
    )
    op.add_column(
        "providers",
        sa.Column("cooldown_until", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("last_error", sa.String(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("last_error_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("rpm_remaining", sa.Integer(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("tpm_remaining", sa.Integer(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("rpm_limit", sa.Integer(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("tpm_limit", sa.Integer(), nullable=True),
    )
    op.add_column(
        "providers",
        sa.Column("quota_reset_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column("providers", "quota_reset_at")
    op.drop_column("providers", "tpm_limit")
    op.drop_column("providers", "rpm_limit")
    op.drop_column("providers", "tpm_remaining")
    op.drop_column("providers", "rpm_remaining")
    op.drop_column("providers", "last_error_at")
    op.drop_column("providers", "last_error")
    op.drop_column("providers", "cooldown_until")
    op.drop_column("providers", "circuit_state")
    op.drop_column("providers", "consecutive_failures")
