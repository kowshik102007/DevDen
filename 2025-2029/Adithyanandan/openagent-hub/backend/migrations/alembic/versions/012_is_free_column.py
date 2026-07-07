"""Add is_free column to model_catalog

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"


def upgrade():
    op.add_column(
        "model_catalog",
        sa.Column("is_free", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade():
    op.drop_column("model_catalog", "is_free")
