import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import Connection, text

from app.deps import DbDep, Parent
from app.game import engine
from app.people import record_consent

router = APIRouter(prefix="/parent", tags=["parent"])


class LinkIn(BaseModel):
    code: str


class ConsentIn(BaseModel):
    learner_id: str
    granted: bool


class DeletionIn(BaseModel):
    learner_id: str


def linked(db: Connection, parent_id: str, learner_id: str) -> None:
    ok = db.execute(text("select exists (select 1 from parent_links where parent_id=:p and "
                         "learner_id=:l)"), {"p": parent_id, "l": learner_id}).scalar()
    if not ok:
        raise HTTPException(404, "Child not found")


@router.post("/link")
def link_child(body: LinkIn, db: DbDep, user: Parent) -> dict[str, str]:
    row = db.execute(text(
        "select learner_id, used_at is not null as used, expires_at < now() as expired "
        "from link_codes where code=:c for update"),
        {"c": body.code.strip().upper()}).mappings().first()
    if row is None or row["used"] or row["expired"]:
        raise HTTPException(404, "This code is not valid. Ask for a new one.")
    db.execute(text("update link_codes set used_at=now() where code=:c"),
               {"c": body.code.strip().upper()})
    db.execute(text("insert into parent_links values (:p,:l) on conflict do nothing"),
               {"p": user.id, "l": row["learner_id"]})
    return {"learner_id": str(row["learner_id"])}


@router.get("/children")
def children(db: DbDep, user: Parent) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select l.id, coalesce(u.name, cs.name) as name, l.kind from parent_links p "
        "join learners l on l.id=p.learner_id left join users u on u.id=l.user_id "
        "left join call_students cs on cs.id=l.call_student_id where p.parent_id=:p order by name"),
        {"p": user.id}).mappings().all()
    return [{"learner_id": str(x["id"]), "name": x["name"], "is_call": x["kind"] == "call"}
            for x in rows]


@router.get("/children/{learner_id}/summary")
def summary(learner_id: str, db: DbDep, user: Parent) -> dict[str, Any]:
    """Weekly picture for a parent. Doubt text is never included."""
    linked(db, user.id, learner_id)
    now = engine.utcnow()
    st = engine.load_stats(db, learner_id, now, lock=False)
    week = db.execute(text(
        "select count(*) as answers, count(*) filter (where correct) as right, "
        "coalesce(sum(xp),0) as xp, count(distinct (created_at at time zone 'Asia/Kolkata')::date)"
        " as days from answer_attempts where learner_id=:l and created_at > now() - interval "
        "'7 days'"), {"l": learner_id}).mappings().one()
    lessons = db.execute(text("select count(*) from lesson_progress where learner_id=:l and "
                              "completed_at > now() - interval '7 days'"),
                         {"l": learner_id}).scalar_one()
    weak = db.execute(text("select count(*) from twin_concepts where learner_id=:l and "
                           "mastery < 0.6"), {"l": learner_id}).scalar_one()
    consent = db.execute(text("select granted from consent_records where learner_id=:l "
                              "order by created_at desc limit 1"), {"l": learner_id}).scalar()
    return {"xp_this_week": int(week["xp"]), "lessons_this_week": lessons,
            "days_active": week["days"], "streak": engine.display_streak(st, now),
            "accuracy": round(week["right"] / week["answers"], 2) if week["answers"] else None,
            "concepts_to_revise": weak, "consent": consent}


@router.post("/consent")
def consent(body: ConsentIn, db: DbDep, user: Parent) -> dict[str, bool]:
    linked(db, user.id, body.learner_id)
    record_consent(db, body.learner_id, "parent_app", body.granted, actor=user.id)
    return {"granted": body.granted}


@router.post("/deletion")
def request_deletion(body: DeletionIn, db: DbDep, user: Parent) -> dict[str, str]:
    """Deletes the child, their twin, attempts and game rows (including call-only records)."""
    linked(db, user.id, body.learner_id)
    row = db.execute(text("select user_id, call_student_id from learners where id=:l"),
                     {"l": body.learner_id}).mappings().one()
    db.execute(text("insert into deletion_requests(learner_id, requested_by, status) "
                    "values (:l,:p,'done')"), {"l": body.learner_id, "p": user.id})
    db.execute(text("insert into audit_log(actor, action, detail) values (:a,'learner_deleted',"
                    "cast(:d as jsonb))"),
               {"a": user.id, "d": json.dumps({"learner_id": body.learner_id})})
    if row["user_id"]:
        db.execute(text("delete from users where id=:u"), {"u": row["user_id"]})
    else:
        db.execute(text("delete from call_students where id=:c"), {"c": row["call_student_id"]})
    return {"status": "done"}
