"""consent timestamps use the real clock

Revision ID: 0005
"""
from pathlib import Path

from alembic import op

revision = "0005"
down_revision = "0004"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0006_consent_clock.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    pass
