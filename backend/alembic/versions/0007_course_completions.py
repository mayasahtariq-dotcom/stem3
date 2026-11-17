"""course completions

Revision ID: 0007
"""
from pathlib import Path

from alembic import op

revision = "0007"
down_revision = "0006"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0008_course_completions.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists course_completions")
