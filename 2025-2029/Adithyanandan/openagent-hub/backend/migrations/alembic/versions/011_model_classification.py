"""Add model classification columns to model_catalog

Revision ID: 011
Revises: 010
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"


def upgrade():
    op.add_column("model_catalog", sa.Column("knowledge_score", sa.Integer(), nullable=True))
    op.add_column("model_catalog", sa.Column("model_family", sa.String(), nullable=True))
    op.add_column("model_catalog", sa.Column("param_billions", sa.Float(), nullable=True))
    op.add_column("model_catalog", sa.Column("reliability_score", sa.Integer(), nullable=True))
    op.add_column("model_catalog", sa.Column("avg_latency_ms", sa.Integer(), nullable=True))
    op.add_column("model_catalog", sa.Column("error_rate", sa.Float(), nullable=True))
    op.add_column("model_catalog", sa.Column("last_stats_at", sa.DateTime(), nullable=True))


def downgrade():
    for col in ("last_stats_at", "error_rate", "avg_latency_ms", "reliability_score",
                "param_billions", "model_family", "knowledge_score"):
        op.drop_column("model_catalog", col)
