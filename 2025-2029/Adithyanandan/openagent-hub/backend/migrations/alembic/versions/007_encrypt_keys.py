"""encrypt provider api keys at rest (AES-256-GCM backfill)

Revision ID: 007
Revises: 006
Create Date: 2026-06-16 00:00:00.000000

Backfills existing plaintext provider API keys into the ``v1:`` AES-256-GCM
ciphertext format. Both ``providers`` and ``provider_configs`` store secrets.

The encryption is idempotent (``crypto.encrypt`` skips already-prefixed values
and empty strings), so re-running is safe. Downgrade decrypts back to plaintext
so the column stays usable if the app is rolled back.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.core import crypto

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("providers", "provider_configs")


def upgrade() -> None:
    conn = op.get_bind()
    for table in _TABLES:
        rows = conn.execute(
            sa.text(f"SELECT id, api_key FROM {table}")
        ).fetchall()
        for row_id, api_key in rows:
            if not api_key or crypto.is_encrypted(api_key):
                continue
            conn.execute(
                sa.text(f"UPDATE {table} SET api_key = :k WHERE id = :id"),
                {"k": crypto.encrypt(api_key), "id": row_id},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for table in _TABLES:
        rows = conn.execute(
            sa.text(f"SELECT id, api_key FROM {table}")
        ).fetchall()
        for row_id, api_key in rows:
            if not api_key or not crypto.is_encrypted(api_key):
                continue
            conn.execute(
                sa.text(f"UPDATE {table} SET api_key = :k WHERE id = :id"),
                {"k": crypto.decrypt(api_key), "id": row_id},
            )
