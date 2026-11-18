"""Course, chapter and lesson titles in every language.

Titles are saved in the language of the teacher's notes. Gemini translates each course's titles once into
English, Hindi and Kannada; they are kept in `text_translations` and in memory, so a Kannada student sees
Kannada titles even when the notes were Hindi (and the other way round)."""
import logging
import time
from typing import Any

from sqlalchemy import Connection, text

log = logging.getLogger(__name__)
CACHE: dict[str, dict[str, str]] = {}
_loaded_at = 0.0
REFRESH_SECONDS = 120

SCHEMA = {"type": "OBJECT", "properties": {"items": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "source": {"type": "STRING"}, "en": {"type": "STRING"}, "hi": {"type": "STRING"}, "kn": {"type": "STRING"}},
    "required": ["source", "en", "hi", "kn"]}}}, "required": ["items"]}
SYSTEM = ("You translate short school science titles for Indian students. For each source title give English (en), "
          "Hindi in Devanagari only (hi) and Kannada in Kannada script only (kn). Keep them short. Keep the source text "
          "exactly as given in 'source'. An English term in brackets may stay in English.")


def lookup(s: str) -> dict[str, str] | None:
    return CACHE.get(s.strip()) if s else None


def load(db: Connection) -> None:
    global _loaded_at
    rows = db.execute(text("select source, en, hi, kn from text_translations")).mappings().all()
    CACHE.clear()
    CACHE.update({r["source"]: {"en": r["en"], "hi": r["hi"], "kn": r["kn"]} for r in rows})
    _loaded_at = time.monotonic()


def refresh_if_stale(engine: Any) -> None:
    """Reload now and then, so titles translated by another process show up."""
    if time.monotonic() - _loaded_at < REFRESH_SECONDS:
        return
    try:
        with engine.connect() as c:
            load(c)
    except Exception:
        log.warning("could not load title translations", exc_info=True)


def course_titles(db: Connection, course_id: Any) -> list[str]:
    c = db.execute(text("select title from courses where id=:c"), {"c": course_id}).scalars().all()
    u = db.execute(text("select title from units where course_id=:c"), {"c": course_id}).scalars().all()
    lessons = db.execute(text("select l.title from lessons l join units u on u.id=l.unit_id where u.course_id=:c"),
                         {"c": course_id}).scalars().all()
    return [t.strip() for t in [*c, *u, *lessons] if t and t.strip()]


def translate_course(db: Connection, llm: Any, course_id: Any) -> int:
    """Translate this course's titles that have no translation yet. Returns how many were added."""
    have = {r for r in db.execute(text("select source from text_translations")).scalars().all()}
    todo = sorted({t for t in course_titles(db, course_id) if t not in have})
    if not todo:
        return 0
    out = llm.generate_json("Titles:\n" + "\n".join(f"- {t}" for t in todo), SCHEMA, system=SYSTEM)
    added = 0
    by_source = {str(i.get("source", "")).strip(): i for i in (out.get("items") or [])}
    for src in todo:
        item = by_source.get(src)
        if not item or not all(str(item.get(k, "")).strip() for k in ("en", "hi", "kn")):
            continue
        added += db.execute(text("insert into text_translations(source, en, hi, kn) values (:s,:en,:hi,:kn) "
                                 "on conflict (source) do nothing"),
                            {"s": src, "en": item["en"].strip(), "hi": item["hi"].strip(), "kn": item["kn"].strip()}).rowcount
    db.commit()
    load(db)
    return added
