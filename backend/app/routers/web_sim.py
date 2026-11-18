"""Browser phone simulator: the session log of each simulated call, and the channel views for teachers
and parents. Answers and lesson completion go through the normal /web/attempts and /web/lessons/*
endpoints (same student, same XP, same twin); X-Channel: phone_simulator tags those answers.
Nothing here places a real call."""
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.deps import DbDep, UserDep
from app.routers.web_compat import _lid
from app.routers.web_compat_b import _linked, _own_class, _students

router = APIRouter(prefix="/web", tags=["web-sim"])
QUIET_SECONDS = 120          # an active call with no news for this long counts as interrupted


class SessionIn(BaseModel):
    lesson_id: str | None = None


class SessionPatch(BaseModel):
    status: Literal["active", "completed", "ended"]
    answered: int = Field(ge=0, le=500)
    correct: int = Field(ge=0, le=500)
    incorrect: int = Field(ge=0, le=500)
    question_index: int = Field(ge=0, le=500)
    question_count: int = Field(ge=0, le=500)
    lessons_completed: int = Field(ge=0, le=1)
    seconds: int = Field(ge=0, le=6 * 3600)


@router.post("/sim/sessions", status_code=201)
def start_session(body: SessionIn, db: DbDep, user: UserDep) -> dict[str, str]:
    lid = _lid(db, user)
    sid = db.execute(text("insert into sim_sessions(learner_id, lesson_id) values (:l, :le) returning id"),
                     {"l": lid, "le": body.lesson_id}).scalar_one()
    return {"id": str(sid)}


@router.patch("/sim/sessions/{session_id}")
def update_session(session_id: str, body: SessionPatch, db: DbDep, user: UserDep) -> dict[str, str]:
    lid = _lid(db, user)
    row = db.execute(text("select status from sim_sessions where id=cast(:s as uuid) and learner_id=:l"),
                     {"s": session_id, "l": lid}).first()
    if row is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    if row[0] != "active":                      # a finished call can't be reopened or recounted
        raise HTTPException(409, {"code": "CONFLICT"})
    db.execute(text(
        "update sim_sessions set status=:status, answered=:answered, correct=:correct, "
        "incorrect=:incorrect, question_index=:question_index, question_count=:question_count, "
        "lessons_completed=:lessons_completed, seconds=:seconds, last_at=now() where id=cast(:s as uuid)"),
        body.model_dump() | {"s": session_id})
    return {"id": session_id, "status": body.status}


def activity(db: Connection, learner_ids: list[Any]) -> dict[str, Any]:
    if not learner_ids:
        learner_ids = ["00000000-0000-0000-0000-000000000000"]
    ids = {"ids": [str(x) for x in learner_ids], "quiet": QUIET_SECONDS}
    state = ("case when s.status='completed' then 'completed' when s.status='ended' or "
             "s.last_at < now() - make_interval(secs => :quiet) then 'interrupted' else 'active' end")
    agg = db.execute(text(
        f"select count(distinct s.learner_id) as users, count(*) as sessions, "
        f"coalesce(sum(s.lessons_completed),0) as lessons, coalesce(sum(s.seconds),0) as seconds, "
        f"count(*) filter (where {state}='interrupted') as interrupted "
        f"from sim_sessions s where s.learner_id = any(cast(:ids as uuid[]))"), ids).mappings().one()
    ch = db.execute(text(
        "select count(*) filter (where channel='phone_simulator') as phone, "
        "count(*) filter (where channel='phone_simulator' and correct) as phone_ok, "
        "count(*) filter (where channel<>'phone_simulator') as app "
        "from answer_attempts where learner_id = any(cast(:ids as uuid[]))"), ids).mappings().one()
    total_lessons = db.execute(text(
        "select count(*) from lesson_progress where status='completed' and "
        "learner_id = any(cast(:ids as uuid[]))"), ids).scalar_one()
    recent = db.execute(text(
        f"select s.id, coalesce(u.name, cs.name, 'Student') as name, s.started_at, s.seconds, "
        f"{state} as state, s.answered, s.correct, s.question_count from sim_sessions s "
        f"join learners l on l.id=s.learner_id left join users u on u.id=l.user_id "
        f"left join call_students cs on cs.id=l.call_student_id "
        f"where s.learner_id = any(cast(:ids as uuid[])) order by s.started_at desc limit 10"),
        ids).mappings().all()
    phone_lessons = int(agg["lessons"])
    return {
        "simulator_users": agg["users"], "sessions": agg["sessions"], "lessons_completed": phone_lessons,
        "correct": ch["phone_ok"], "incorrect": ch["phone"] - ch["phone_ok"],
        "call_seconds": int(agg["seconds"]), "interrupted": agg["interrupted"],
        "channels": {"app": {"answers": ch["app"], "lessons": max(0, int(total_lessons) - phone_lessons)},
                     "phone_simulator": {"answers": ch["phone"], "lessons": phone_lessons}},
        "recent": [{"id": str(r["id"]), "student_name": r["name"], "started_at": r["started_at"].isoformat(),
                    "seconds": r["seconds"], "status": r["state"], "answered": r["answered"],
                    "correct": r["correct"], "question_count": r["question_count"]} for r in recent],
    }


@router.get("/classrooms/{classroom_id}/sim-activity")
def class_activity(classroom_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    c = _own_class(db, user, classroom_id)
    return activity(db, [s["lid"] for s in _students(db, c["id"])])


@router.get("/parent/children/{child_id}/sim-activity")
def child_activity(child_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _linked(db, user, child_id)
    return activity(db, [child_id])
