"""class notes shared with a classroom

Revision ID: 0014
"""
from pathlib import Path

from alembic import op

revision = "0014"
down_revision = "0013"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0015_class_notes.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists class_notes")
