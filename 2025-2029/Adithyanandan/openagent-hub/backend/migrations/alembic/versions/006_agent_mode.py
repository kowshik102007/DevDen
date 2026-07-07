"""agent run mode (auto/goal/plan)

Revision ID: 006
Revises: 005
Create Date: 2026-06-16 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("mode", sa.String(), nullable=False, server_default="auto"),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "mode")
