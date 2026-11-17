"""classroom subject/grade, upload start

Revision ID: 0012
"""
from pathlib import Path

from alembic import op

revision = "0012"
down_revision = "0011"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0013_web_fields.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
