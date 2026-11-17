"""Terms (glossary, saved terms) and doubt chat that cites the notes."""
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.deps import DbDep, Student, learner_id_for

router = APIRouter(tags=["learning"])

ACCESSIBLE = ("c.status='published' and exists (select 1 from course_assignments a "
              "join memberships m on m.classroom_id=a.classroom_id "
              "where a.course_id=c.id and m.user_id=:u)")


@router.get("/courses/{course_id}/terms")
def course_terms(course_id: str, db: DbDep, user: Student) -> list[dict[str, Any]]:
    lid = learner_id_for(db, user.id)
    rows = db.execute(text(
        f"select t.id, t.regional, t.english, t.definition, (s.term_id is not null) as saved "
        f"from terms t join courses c on c.id=t.course_id "
        f"left join saved_terms s on s.term_id=t.id and s.learner_id=:l "
        f"where c.id=:c and {ACCESSIBLE} order by t.english"),
        {"c": course_id, "u": user.id, "l": lid}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


@router.get("/me/saved-terms")
def saved_terms(db: DbDep, user: Student) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select t.id, t.regional, t.english, t.definition from saved_terms s "
        "join terms t on t.id=s.term_id where s.learner_id=:l order by t.english"),
        {"l": learner_id_for(db, user.id)}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


@router.post("/terms/{term_id}/save", status_code=204)
def save_term(term_id: str, db: DbDep, user: Student) -> None:
    ok = db.execute(text(f"select exists (select 1 from terms t join courses c on c.id=t.course_id "
                         f"where t.id=:t and {ACCESSIBLE})"), {"t": term_id, "u": user.id}).scalar()
    if not ok:
        raise HTTPException(404, "Term not found")
    db.execute(text("insert into saved_terms values (:l,:t) on conflict do nothing"),
               {"l": learner_id_for(db, user.id), "t": term_id})


@router.delete("/terms/{term_id}/save", status_code=204)
def unsave_term(term_id: str, db: DbDep, user: Student) -> None:
    db.execute(text("delete from saved_terms where learner_id=:l and term_id=:t"),
               {"l": learner_id_for(db, user.id), "t": term_id})
