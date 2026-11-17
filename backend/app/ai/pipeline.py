"""Notes to course (P3): OCR each photo/PDF, then an outline plus a full first lesson.

Target: under 60 seconds. Questions the model is unsure about (or that come from a hard-to-read
page) are flagged so the teacher reviews them first. Nothing is published automatically."""
import json
import logging
import time
from typing import Any

from sqlalchemy import Connection, text

from app import storage
from app.ai.provider import LLMProvider, Part

log = logging.getLogger(__name__)
FLAG_BELOW = 0.7
MAX_OCR_CHARS = 30000

BI = {"type": "OBJECT", "properties": {"en": {"type": "STRING"}, "hi": {"type": "STRING"},
                                       "kn": {"type": "STRING"}}, "required": ["en", "hi", "kn"]}
OCR_SCHEMA = {"type": "OBJECT", "properties": {"pages": {"type": "ARRAY", "items": {
    "type": "OBJECT", "properties": {"page_no": {"type": "INTEGER"}, "text": {"type": "STRING"},
                                     "confidence": {"type": "NUMBER"}},
    "required": ["page_no", "text", "confidence"]}}}, "required": ["pages"]}
QUESTION = {"type": "OBJECT", "properties": {
    "kind": {"type": "STRING", "enum": ["mcq", "true_false", "fill_in"]}, "prompt": BI,
    "options": {"type": "ARRAY", "items": BI}, "answer_index": {"type": "INTEGER"},
    "answer_bool": {"type": "BOOLEAN"}, "concept": {"type": "STRING"},
    "source_page": {"type": "INTEGER"}, "confidence": {"type": "NUMBER"}},
    "required": ["kind", "prompt", "concept", "source_page", "confidence"]}
COURSE_SCHEMA = {"type": "OBJECT", "properties": {
    "title": {"type": "STRING"},
    "subject": {"type": "STRING", "enum": ["biology", "chemistry", "physics"]},
    "units": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "title": {"type": "STRING"},
        "lessons": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "title": {"type": "STRING"}, "reading": BI,
            "questions": {"type": "ARRAY", "items": QUESTION}}, "required": ["title", "questions"]}}},
        "required": ["title", "lessons"]}},
    "terms": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "regional": {"type": "STRING"}, "english": {"type": "STRING"}, "definition": BI},
        "required": ["regional", "english"]}}},
    "required": ["title", "subject", "units"]}
QUESTIONS_SCHEMA = {"type": "OBJECT", "properties": {"questions": {"type": "ARRAY", "items": QUESTION}},
                    "required": ["questions"]}

SYSTEM = ("You make short, accurate science lessons for Indian students in Classes 6 to 10, from the "
          "teacher's own notes. Use only facts that appear in the notes. Write every student-facing "
          "text in Hindi (hi), Kannada (kn) and English (en). Keep sentences short and simple. "
          "Give each question a confidence from 0 to 1: lower it when the notes are unclear.")
LANG = {"hi": "Hindi", "kn": "Kannada", "en": "English"}


def set_status(db: Connection, upload_id: str, status: str, **extra: Any) -> None:
    cols = ", ".join(f"{k} = :{k}" for k in extra)
    db.execute(text(f"update uploads set status=:s{', ' + cols if cols else ''} where id=:u"),
               {"s": status, "u": upload_id, **extra})
    db.commit()


def run_pipeline(db: Connection, llm: LLMProvider, upload_id: str) -> None:
    t0 = time.monotonic()
    try:
        _run(db, llm, upload_id)
        set_status(db, upload_id, "done", elapsed_ms=int((time.monotonic() - t0) * 1000),
                   finished_at=None)
        db.execute(text("update uploads set finished_at=now() where id=:u"), {"u": upload_id})
        db.commit()
    except Exception as exc:
        log.exception("upload pipeline failed")
        db.rollback()
        set_status(db, upload_id, "failed", error=str(exc)[:500],
                   elapsed_ms=int((time.monotonic() - t0) * 1000))


def _run(db: Connection, llm: LLMProvider, upload_id: str) -> None:
    up = db.execute(text("select teacher_id, language, class_level from uploads where id=:u"),
                    {"u": upload_id}).mappings().one()
    files = db.execute(text("select id, page_no, storage_path, mime from upload_pages "
                            "where upload_id=:u order by page_no"), {"u": upload_id}).mappings().all()
    set_status(db, upload_id, "ocr")

    # 1. OCR: one call per file (a PDF may hold many pages)
    pages: list[dict[str, Any]] = []
    for f in files:
        out = llm.generate_json(
            "Read all the text in this page of class notes (OCR). Keep the original language. "
            "Handwriting is common: give a confidence from 0 to 1 for how well you could read it. "
            "If this is a PDF, return one entry per page.", OCR_SCHEMA,
            parts=[Part(f["mime"], storage.read(f["storage_path"]))], system=SYSTEM)
        got = out.get("pages") or [{"page_no": 1, "text": "", "confidence": 0}]
        for i, p in enumerate(got):
            if i == 0:
                db.execute(text("update upload_pages set ocr_text=:t, confidence=:c where id=:i"),
                           {"t": p.get("text", ""), "c": float(p.get("confidence", 0)), "i": f["id"]})
                pid = f["id"]
            else:                                   # extra PDF pages become their own rows
                pid = db.execute(text(
                    "insert into upload_pages(upload_id, page_no, storage_path, mime, ocr_text, "
                    "confidence) values (:u,:n,:s,:m,:t,:c) returning id"),
                    {"u": upload_id, "n": f["page_no"] * 100 + i, "s": f["storage_path"],
                     "m": f["mime"], "t": p.get("text", ""), "c": float(p.get("confidence", 0))}
                ).scalar_one()
            pages.append({"id": pid, "n": len(pages) + 1, "text": p.get("text", ""),
                          "confidence": float(p.get("confidence", 0))})
    db.commit()
    if not any(p["text"].strip() for p in pages):
        raise RuntimeError("No readable text was found in these notes. Try a clearer photo.")

    # 2. Outline + first lesson in one call
    set_status(db, upload_id, "outline")
    notes = "\n\n".join(f"[PAGE {p['n']}]\n{p['text']}" for p in pages)[:MAX_OCR_CHARS]
    level = f"Class {up['class_level']}" if up["class_level"] else "Classes 6 to 10"
    course = llm.generate_json(
        f"Teacher's notes ({LANG.get(up['language'], 'Hindi')} medium, {level}):\n{notes}\n\n"
        "Make a course: a title, the subject, 1 to 3 units, each with 2 to 4 short lessons. "
        "For the FIRST lesson only, write a short reading (2 to 4 sentences) and 6 to 8 questions "
        "(mostly multiple choice with 3 options, some true/false); use answer_index for the right "
        "option and answer_bool for true/false; source_page is the [PAGE n] the fact came from. "
        "Other lessons: title only, empty questions. Also list 3 to 8 key terms.",
        COURSE_SCHEMA, system=SYSTEM)
    course_id = save_course(db, up["teacher_id"], course, pages)
    db.execute(text("update uploads set course_id=:c where id=:u"), {"c": course_id, "u": upload_id})
    db.commit()


def _answer(q: dict[str, Any]) -> tuple[Any, list[Any] | None]:
    if q.get("kind") == "true_false":
        return bool(q.get("answer_bool")), None
    opts = q.get("options") or []
    if q.get("kind") == "fill_in":
        ans = opts[q.get("answer_index", 0)] if opts else q.get("prompt", {})
        return [ans.get("en", ""), ans.get("hi", ""), ans.get("kn", "")] if isinstance(ans, dict) else ans, None
    idx = q.get("answer_index", 0)
    if not opts or not 0 <= idx < len(opts):
        raise ValueError("question without a valid answer")
    return opts[idx], opts


def insert_questions(db: Connection, lesson_id: Any, questions: list[dict[str, Any]],
                     pages: list[dict[str, Any]], start: int = 1) -> int:
    by_n = {p["n"]: p for p in pages}
    n = 0
    for q in questions:
        try:
            answer, options = _answer(q)
        except ValueError:
            continue
        page = by_n.get(int(q.get("source_page") or 0))
        conf = float(q.get("confidence", 0))
        flagged = conf < FLAG_BELOW or (page is not None and page["confidence"] < FLAG_BELOW)
        prompt = q.get("prompt", {})
        db.execute(text(
            "insert into questions(lesson_id, kind, prompt, options, answer, concept, call_safe, "
            "flagged, source_page_id, position) values (:l,:k,cast(:p as jsonb),cast(:o as jsonb),"
            "cast(:a as jsonb),:c,:cs,:f,:sp,:pos)"),
            {"l": lesson_id, "k": q.get("kind", "mcq"),
             "p": json.dumps({**prompt, "regional": prompt.get("hi", ""), "english": prompt.get("en", "")},
                             ensure_ascii=False),
             "o": json.dumps(options, ensure_ascii=False) if options else None,
             "a": json.dumps(answer, ensure_ascii=False), "c": (q.get("concept") or "")[:80] or None,
             "cs": q.get("kind") in ("mcq", "true_false"), "f": flagged,
             "sp": page["id"] if page else None, "pos": start + n})
        n += 1
    return n


def save_course(db: Connection, teacher_id: Any, c: dict[str, Any], pages: list[dict[str, Any]]) -> Any:
    subject = c.get("subject") if c.get("subject") in ("biology", "chemistry", "physics") else "biology"
    course_id = db.execute(text("insert into courses(teacher_id, title, subject) values (:t,:n,:s) "
                                "returning id"),
                           {"t": teacher_id, "n": (c.get("title") or "New course")[:120],
                            "s": subject}).scalar_one()
    for ui, unit in enumerate(c.get("units") or [], start=1):
        uid = db.execute(text("insert into units(course_id, position, title) values (:c,:p,:t) "
                              "returning id"), {"c": course_id, "p": ui, "t": unit.get("title", "Unit")}
                         ).scalar_one()
        for li, lesson in enumerate(unit.get("lessons") or [], start=1):
            reading = lesson.get("reading") or {}
            has_reading = any((reading.get(k) or "").strip() for k in ("en", "hi", "kn"))
            lid = db.execute(text(
                "insert into lessons(unit_id, position, title, kind, content) values "
                "(:u,:p,:t,'quiz',cast(:c as jsonb)) returning id"),
                {"u": uid, "p": li, "t": lesson.get("title", "Lesson"),
                 "c": json.dumps({"body": reading} if has_reading else {}, ensure_ascii=False)}
            ).scalar_one()
            insert_questions(db, lid, lesson.get("questions") or [], pages)
    for term in c.get("terms") or []:
        db.execute(text("insert into terms(course_id, regional, english, definition) values "
                        "(:c,:r,:e,cast(:d as jsonb))"),
                   {"c": course_id, "r": term.get("regional", ""), "e": term.get("english", ""),
                    "d": json.dumps(term.get("definition"), ensure_ascii=False)
                    if term.get("definition") else None})
    return course_id


def generate_more(db: Connection, llm: LLMProvider, lesson_id: str, count: int = 6) -> int:
    """Teacher asks for questions for a later lesson (or more for the current one)."""
    row = db.execute(text(
        "select l.title, c.id as course_id from lessons l join units u on u.id=l.unit_id "
        "join courses c on c.id=u.course_id where l.id=:l"), {"l": lesson_id}).mappings().one()
    src = db.execute(text(
        "select p.id, p.ocr_text, coalesce(p.confidence,1) as confidence from upload_pages p "
        "join uploads up on up.id=p.upload_id where up.course_id=:c order by p.page_no"),
        {"c": row["course_id"]}).mappings().all()
    pages = [{"id": p["id"], "n": i + 1, "text": p["ocr_text"] or "", "confidence": p["confidence"]}
             for i, p in enumerate(src)]
    notes = "\n\n".join(f"[PAGE {p['n']}]\n{p['text']}" for p in pages)[:MAX_OCR_CHARS]
    existing = db.execute(text("select coalesce(max(position),0) from questions where lesson_id=:l"),
                          {"l": lesson_id}).scalar_one()
    out = llm.generate_json(
        f"Notes:\n{notes or '(no notes uploaded)'}\n\nWrite {count} questions for the lesson "
        f"'{row['title']}' (multiple choice with 3 options, some true/false).", QUESTIONS_SCHEMA,
        system=SYSTEM)
    return insert_questions(db, lesson_id, out.get("questions") or [], pages, start=int(existing) + 1)
