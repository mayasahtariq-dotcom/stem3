from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.deps import DbDep, Student, learner_id_for
from app.game import engine
from app.twin import model as twin

router = APIRouter(tags=["student"])


class AttemptIn(BaseModel):
    question_id: str
    answer: Any


@router.post("/lessons/{lesson_id}/start")
def start_lesson(lesson_id: str, db: DbDep, user: Student) -> dict[str, Any]:
    """Starts (or restarts) a lesson. Video and reading lessons return their content; quiz and
    interactive lessons return questions without answers (answers are checked by /attempts)."""
    questions = engine.start_lesson(db, user.id, lesson_id)
    meta = db.execute(text("select id, title, kind, content from lessons where id=:l"),
                      {"l": lesson_id}).mappings().one()
    return {"lesson": {**dict(meta), "id": str(meta["id"])}, "questions": questions}


@router.post("/attempts")
def attempt(body: AttemptIn, db: DbDep, user: Student) -> dict[str, Any]:
    return engine.record_attempt(db, user.id, body.question_id, body.answer)


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: str, db: DbDep, user: Student) -> dict[str, Any]:
    return engine.complete_lesson(db, user.id, lesson_id)


def _paths(db: Any, user_id: str, lid: Any, course_id: str | None) -> list[dict[str, Any]]:
    courses = db.execute(text(
        "select distinct c.id, c.title, c.subject from courses c "
        "join course_assignments a on a.course_id=c.id "
        "join memberships m on m.classroom_id=a.classroom_id "
        "where m.user_id=:u and c.status='published' and (cast(:c as uuid) is null or c.id = cast(:c as uuid)) "
        "order by c.title"), {"u": user_id, "c": course_id}).mappings().all()
    out = []
    for c in courses:
        rows = db.execute(text(
            "select u.id as unit_id, u.title as unit_title, u.position as up, l.id as lesson_id, "
            "l.title, l.kind, l.position as lp, p.completed_at is not null as done "
            "from units u join lessons l on l.unit_id=u.id "
            "left join lesson_progress p on p.lesson_id=l.id and p.learner_id=:l "
            "where u.course_id=:c order by u.position, l.position"),
            {"l": lid, "c": c["id"]}).mappings().all()
        units: dict[str, dict[str, Any]] = {}
        current_set = False
        for x in rows:
            u = units.setdefault(str(x["unit_id"]),
                                 {"id": str(x["unit_id"]), "title": x["unit_title"], "lessons": []})
            if x["done"]:
                state = "completed"
            elif not current_set:
                state, current_set = "current", True
            else:
                state = "locked"
            u["lessons"].append({"id": str(x["lesson_id"]), "title": x["title"],
                                 "kind": x["kind"], "state": state})
        out.append({"id": str(c["id"]), "title": c["title"], "subject": c["subject"],
                    "units": list(units.values())})
    return out


@router.get("/courses/{course_id}/path")
def course_path(course_id: str, db: DbDep, user: Student) -> dict[str, Any]:
    lid = learner_id_for(db, user.id)
    paths = _paths(db, user.id, lid, course_id)
    if not paths:
        raise HTTPException(404, "Course not found")
    return paths[0]


@router.get("/home")
def home(db: DbDep, user: Student) -> dict[str, Any]:
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    st = engine.load_stats(db, lid, now, lock=False)
    paths = _paths(db, user.id, lid, None)
    cont = None
    for c in paths:
        for u in c["units"]:
            for le in u["lessons"]:
                if le["state"] == "current" and cont is None:
                    cont = {"course_id": c["id"], "course_title": c["title"],
                            "lesson_id": le["id"], "lesson_title": le["title"]}
    return {"stats": engine.public_stats(db, lid, st, now), "continue": cont,
            "courses": [{"id": c["id"], "title": c["title"]} for c in paths]}


@router.get("/twin/concepts")
def my_concepts(db: DbDep, user: Student) -> list[dict[str, Any]]:
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    rows = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review "
                           "from twin_concepts where learner_id=:l order by concept"),
                      {"l": lid}).mappings().all()
    out = []
    for x in rows:
        s = twin.TwinState(**x)
        eff = twin.effective_mastery(s, now)
        out.append({"concept": x["concept"], "mastery": round(eff, 3), "stars": twin.stars(eff),
                    "next_review": x["next_review"]})
    return out
