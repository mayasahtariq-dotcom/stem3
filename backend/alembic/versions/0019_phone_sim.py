"""browser phone simulator: attempt channel and session log

Revision ID: 0019
"""
from pathlib import Path

from alembic import op

revision = "0019"
down_revision = "0018"
SQL = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    op.execute((SQL / "0020_phone_sim.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("drop table if exists sim_sessions")
    op.execute("delete from answer_attempts where channel='phone_simulator'")
    op.execute("alter table answer_attempts drop constraint if exists answer_attempts_channel_check")
    op.execute("alter table answer_attempts add constraint answer_attempts_channel_check "
               "check (channel in ('web','call'))")
