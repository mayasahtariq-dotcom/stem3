"""upload pipeline status

Revision ID: 0010
"""
from pathlib import Path

from alembic import op

revision = "0010"
down_revision = "0009"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0011_uploads.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
