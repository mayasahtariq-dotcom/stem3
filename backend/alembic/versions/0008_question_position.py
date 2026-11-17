"""question position

Revision ID: 0008
"""
from pathlib import Path

from alembic import op

revision = "0008"
down_revision = "0007"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0009_question_position.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("alter table questions drop column if exists position")
