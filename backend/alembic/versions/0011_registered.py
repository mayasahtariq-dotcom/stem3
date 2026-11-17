"""users.registered for web onboarding

Revision ID: 0011
"""
from pathlib import Path

from alembic import op

revision = "0011"
down_revision = "0010"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0012_registered.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("alter table users drop column if exists registered")
