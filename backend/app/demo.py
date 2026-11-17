"""Hackathon demo data: a class, a call-only student on your phone and classmates for the league.

No canned courses: real courses come from the teacher uploading notes (POST /v1/uploads)."""
from typing import Any

from sqlalchemy import Connection, text

from app.auth.service import normalize_phone
from app.game import engine, leagues
from app.people import create_learner

TEACHER_PHONE = "+910000000099"
RIVALS = [("Meena", "+910000000101", 45), ("Arjun", "+910000000102", 30),
          ("Fatima", "+910000000103", 20), ("Kiran", "+910000000104", 10)]


def reset_demo(db: Connection) -> None:
    phones = [TEACHER_PHONE] + [p for _, p, _ in RIVALS]
    db.execute(text("delete from users where phone_e164 = any(:p)"), {"p": phones})


def seed_demo(db: Connection, student_phone: str, parent_phone: str | None) -> dict[str, Any]:
    """Wipe and recreate the demo. The call student starts 'waiting for consent'."""
    reset_demo(db)
    teacher = db.execute(text("insert into users(role, name, phone_e164) values "
                              "('teacher','Demo Teacher',:p) returning id"),
                         {"p": TEACHER_PHONE}).scalar_one()
    klass = db.execute(text("insert into classrooms(teacher_id, name, class_key) values "
                            "(:t,'Class 7 Science','DEMO7SCI') on conflict (class_key) do update "
                            "set teacher_id=:t returning id"), {"t": teacher}).scalar_one()
    db.execute(text("update classrooms set school_consent=true where id=:k"), {"k": klass})
    now = engine.utcnow()
    for name, phone, xp in RIVALS:
        uid = db.execute(text("insert into users(role, name, phone_e164) values "
                              "('student',:n,:p) returning id"), {"n": name, "p": phone}
                         ).scalar_one()
        lid = create_learner(db, user_id=uid)
        db.execute(text("insert into memberships values (:c,:u)"), {"c": klass, "u": uid})
        db.execute(text("update student_stats set xp=:x where learner_id=:l"), {"x": xp, "l": lid})
        leagues.add_xp(db, lid, xp, "bronze", now)
    cs = db.execute(text(
        "insert into call_students(classroom_id, name, phone_e164, language, parent_phone_e164, "
        "window_start, window_end) values (:k,'Ananya',:p,'hi',:pp,'09:00','21:00') returning id"),
        {"k": klass, "p": normalize_phone(student_phone),
         "pp": normalize_phone(parent_phone) if parent_phone else None}).scalar_one()
    learner = create_learner(db, call_student_id=cs)
    return {"teacher_id": str(teacher), "classroom_id": str(klass), "call_student_id": str(cs),
            "learner_id": str(learner)}
