"""initial schema and row-level security

Revision ID: 0001
"""
from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    for name in ("0001_schema.sql", "0002_rls.sql"):
        op.execute((SQL / name).read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop schema if exists private cascade")
    op.execute("drop schema public cascade; create schema public;")
    op.execute("grant usage on schema public to postgres, anon, authenticated, service_role")
