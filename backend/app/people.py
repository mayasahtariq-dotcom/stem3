from typing import Any

from sqlalchemy import Connection, text


def create_learner(db: Connection, user_id: Any = None, call_student_id: Any = None) -> Any:
    """Create the learner row plus the game rows every learner needs."""
    kind = "app" if user_id else "call"
    lid = db.execute(text("insert into learners(kind, user_id, call_student_id) "
                          "values (:k,:u,:c) returning id"),
                     {"k": kind, "u": user_id, "c": call_student_id}).scalar_one()
    db.execute(text("insert into student_stats(learner_id) values (:l)"), {"l": lid})
    db.execute(text("insert into mascot_state(learner_id) values (:l)"), {"l": lid})
    return lid


def record_consent(db: Connection, learner_id: Any, given_by: str, granted: bool,
                   actor: Any = None) -> None:
    db.execute(text("insert into consent_records(learner_id, given_by, granted) "
                    "values (:l,:g,:x)"), {"l": learner_id, "g": given_by, "x": granted})
    db.execute(text("insert into audit_log(actor, action, detail) values (:a,:k, "
                    "cast(:d as jsonb))"),
               {"a": actor, "k": "consent_granted" if granted else "consent_revoked",
                "d": f'{{"learner_id": "{learner_id}", "given_by": "{given_by}"}}'})
    # a call-only student becomes active (or stops being called) with consent
    db.execute(text(
        "update call_students set status = case when :x then 'active' else 'declined' end "
        "where id = (select call_student_id from learners where id=:l) "
        "and (:x or status <> 'declined')"), {"x": granted, "l": learner_id})
