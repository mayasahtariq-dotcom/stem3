"""lesson kinds and doubt answers

Revision ID: 0009
"""
from pathlib import Path

from alembic import op

revision = "0009"
down_revision = "0008"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0010_lesson_kinds.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
