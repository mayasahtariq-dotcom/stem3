"""keep generated speech in the database

Revision ID: 0015
"""
from pathlib import Path

from alembic import op

revision = "0015"
down_revision = "0014"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0016_audio_in_db.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("alter table audio_cache drop column if exists data")
