"""game and twin columns, reference data

Revision ID: 0003
"""
from pathlib import Path

from alembic import op

revision = "0003"
down_revision = "0002"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0004_game.sql").read_text(encoding="utf-8"))
    from app.game.seed import seed_reference_sql

    op.execute(seed_reference_sql())


def downgrade() -> None:
    pass
