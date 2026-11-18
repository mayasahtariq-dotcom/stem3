"""summary of a class note

Revision ID: 0016
"""
from pathlib import Path

from alembic import op

revision = "0016"
down_revision = "0015"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0017_note_summary.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("alter table class_notes drop column if exists summary")
