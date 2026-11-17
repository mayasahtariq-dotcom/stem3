"""Terms (glossary, saved terms) and doubt chat that cites the notes."""
import asyncio
import json
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.config import get_settings
from app.deps import DbDep, Student, learner_id_for
from app.providers import get_llm

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


class DoubtIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    lesson_id: str | None = None


def _def_text(d: Any, lang: str) -> str:
    if isinstance(d, dict):
        return str(d.get(lang) or d.get("en") or d.get("english") or next(iter(d.values()), ""))
    return str(d or "")


@router.post("/doubts")
def ask_doubt(body: DoubtIn, db: DbDep, user: Student) -> dict[str, Any]:
    """Answers from the class notes first (term definitions) and says where it came from.
    Falls back to the AI provider (P3's real model when configured). Doubt text stays private."""
    lid = learner_id_for(db, user.id)
    q = body.text.lower()
    words = set(re.findall(r"\w+", q))
    terms = db.execute(text(
        f"select t.regional, t.english, t.definition, c.title from terms t "
        f"join courses c on c.id=t.course_id where {ACCESSIBLE}"), {"u": user.id}).mappings().all()
    best = next((t for t in terms if t["english"].lower() in q or t["regional"] in body.text
                 or t["english"].lower() in words), None)
    citation: dict[str, Any] | None = None
    if best is not None:
        answer = (f"{best['english']} ({best['regional']}): "
                  f"{_def_text(best['definition'], user.language)}").strip(": ")
        citation = {"course": best["title"], "term": best["english"]}
    elif get_settings().use_fake_ai:
        answer = "I could not find this in your class notes yet. Ask your teacher, or try other words."
    else:
        answer = asyncio.run(get_llm(get_settings()).complete(body.text))
    if body.lesson_id and citation is None:
        page = db.execute(text(
            "select p.page_no from questions q join upload_pages p on p.id=q.source_page_id "
            "where q.lesson_id=:l limit 1"), {"l": body.lesson_id}).scalar()
        if page is not None:
            citation = {"page": page}
    did = db.execute(text("insert into doubts(learner_id, text, lesson_id, answer, citation) "
                          "values (:l,:t,:le,:a,cast(:c as jsonb)) returning id"),
                     {"l": lid, "t": body.text, "le": body.lesson_id, "a": answer,
                      "c": json.dumps(citation) if citation else None}).scalar_one()
    return {"id": str(did), "answer": answer, "citation": citation}


@router.get("/doubts")
def my_doubts(db: DbDep, user: Student) -> list[dict[str, Any]]:
    rows = db.execute(text("select id, text, answer, citation, created_at from doubts "
                           "where learner_id=:l order by created_at desc limit 30"),
                      {"l": learner_id_for(db, user.id)}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]
