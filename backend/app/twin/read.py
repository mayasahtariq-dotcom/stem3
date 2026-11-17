"""Reading the Student Twin for screens: always with forgetting applied (effective mastery), never the raw stored number."""
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, text

from app.twin.model import TwinState, effective_mastery


def concepts(db: Connection, learner_ids: list[Any], now: datetime) -> list[dict[str, Any]]:
    """Every concept of these learners with its effective mastery today: [{learner_id, concept, mastery}]."""
    if not learner_ids:
        return []
    rows = db.execute(text("select learner_id, concept, mastery, half_life_days, last_seen, next_review from twin_concepts "
                           "where learner_id = any(cast(:ls as uuid[]))"), {"ls": [str(x) for x in learner_ids]}).mappings().all()
    return [{"learner_id": r["learner_id"], "concept": r["concept"],
             "mastery": effective_mastery(TwinState(r["mastery"], r["half_life_days"], r["last_seen"], r["next_review"]), now)}
            for r in rows]


def weakest(db: Connection, learner_id: Any, now: datetime, limit: int | None = None) -> list[dict[str, Any]]:
    """One learner's concepts, weakest first (after forgetting)."""
    out = sorted(concepts(db, [learner_id], now), key=lambda x: x["mastery"])
    return out[:limit] if limit else out


def class_weak_topics(db: Connection, learner_ids: list[Any], now: datetime, limit: int = 5,
                      low: float = 0.6) -> list[dict[str, Any]]:
    """Concepts the class knows least today: average effective mastery, how many learners have it, how many are low."""
    by: dict[str, list[float]] = defaultdict(list)
    for x in concepts(db, learner_ids, now):
        by[x["concept"]].append(x["mastery"])
    rows = [{"concept": k, "mastery": sum(v) / len(v), "learners": len(v), "low": sum(1 for m in v if m < low)}
            for k, v in by.items()]
    return sorted(rows, key=lambda r: r["mastery"])[:limit]


def term_mastery(db: Connection, learner_id: Any, course_id: Any, now: datetime) -> dict[str, float]:
    """Mastery of each word in a course's word book, keyed by term english: the average effective mastery of the
    learner's concepts that mention the word (in the concept's name or in its questions). Words with no practice
    yet are left out."""
    terms = db.execute(text("select english from terms where course_id=:c"), {"c": course_id}).scalars().all()
    mine = {x["concept"]: x["mastery"] for x in concepts(db, [learner_id], now)}
    if not terms or not mine:
        return {}
    said: dict[str, list[str]] = defaultdict(list)
    for concept, prompt in db.execute(text(
            "select q.concept, coalesce(q.prompt->>'english', q.prompt->>'en', '') from questions q join lessons l "
            "on l.id=q.lesson_id join units u on u.id=l.unit_id where u.course_id=:c and q.concept is not null"),
            {"c": course_id}).all():
        said[concept].append(prompt)
    out: dict[str, float] = {}
    for term in terms:
        word = re.compile(rf"\b{re.escape(term.strip())}\b", re.IGNORECASE)
        hits = [m for c, m in mine.items() if word.search(c) or any(word.search(p) for p in said.get(c, []))]
        if hits:
            out[term] = round(sum(hits) / len(hits), 3)
    return out
