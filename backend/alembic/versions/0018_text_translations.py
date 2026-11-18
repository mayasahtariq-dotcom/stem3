"""translations of course, chapter and lesson titles

Revision ID: 0018
"""
from pathlib import Path

from alembic import op

revision = "0018"
down_revision = "0017"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0019_text_translations.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists text_translations")
