"""private parent links

Revision ID: 0017
"""
from pathlib import Path

from alembic import op

revision = "0017"
down_revision = "0016"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0018_parent_links.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists parent_share_links")
