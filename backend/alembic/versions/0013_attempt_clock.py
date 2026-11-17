"""answer attempts use the real clock

Revision ID: 0013
"""
from pathlib import Path

from alembic import op

revision = "0013"
down_revision = "0012"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0014_attempt_clock.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
