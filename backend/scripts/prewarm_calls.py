"""Pre-record Sarvam call audio for every published course (run before a demo or pilot).

Run from backend/:  python scripts/prewarm_calls.py   (uses Sarvam credits; cached lines are skipped)
"""
from sqlalchemy import text

from app.calls.prewarm import prewarm_course
from app.db.session import get_engine

with get_engine().begin() as conn:
    courses = conn.execute(text("select id, title from courses where status='published' order by title")).all()
    for cid, title in courses:
        print(f"{title}: {prewarm_course(conn, cid)} new clips")
