"""Create (or reset) the hackathon demo. Uses DEMO_PHONE and DEMO_PARENT_PHONE from backend/.env.

Run from backend/:  python scripts/seed_demo.py
"""
from app.config import get_settings
from app.db.session import get_engine
from app.demo import seed_demo

s = get_settings()
if not s.demo_phone:
    raise SystemExit("Set DEMO_PHONE (your verified mobile) in backend/.env first")
with get_engine().begin() as conn:
    out = seed_demo(conn, s.demo_phone, s.demo_parent_phone or s.demo_phone)
print("Demo ready: class 'Class 7 Science', call student Ananya (waiting for consent).")
print("Open", (s.public_base_url or "http://127.0.0.1:8000").rstrip("/") + "/demo")
_ = out
