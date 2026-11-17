"""call session state

Revision ID: 0006
"""
from pathlib import Path

from alembic import op

revision = "0006"
down_revision = "0005"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0007_calls.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
