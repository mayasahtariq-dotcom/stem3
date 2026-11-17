"""school consent flag

Revision ID: 0004
"""
from pathlib import Path

from alembic import op

revision = "0004"
down_revision = "0003"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0005_extra.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
