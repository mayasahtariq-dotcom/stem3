"""otp codes

Revision ID: 0002
"""
from pathlib import Path

from alembic import op

revision = "0002"
down_revision = "0001"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0003_auth.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists otp_codes")
