"""P3 AI routes: notes upload to course, question generation, doubt chatbot, text to speech."""
import json
import re
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from pydantic import BaseModel, Field
from sqlalchemy import text

from app import storage
from app.ai.pipeline import QUESTIONS_SCHEMA, SYSTEM, generate_more, insert_questions, run_pipeline
from app.ai.provider import AIUnavailable, LLMProvider
from app.auth.service import rate_limit
from app.config import get_settings
from app.db.session import get_engine
from app.deps import DbDep, Student, Teacher, UserDep, learner_id_for
from app.providers import get_llm
from app.routers.teacher import _own_question, own_course
from app.speech import cache as speech_cache

router = APIRouter(tags=["ai"])
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES = 20


def llm() -> LLMProvider:
    return get_llm(get_settings())


LLMDep = Annotated[LLMProvider, Depends(llm)]


def _background(upload_id: str) -> None:
    with get_engine().connect() as conn:
        run_pipeline(conn, get_llm(get_settings()), upload_id)


def pipeline_runner() -> Callable[[str], None]:
    """Runs the pipeline after the response. Tests swap in an inline runner."""
    return _background


# ---------- notes upload -> course ----------
@router.post("/uploads", status_code=202)
async def upload_notes(background: BackgroundTasks, db: DbDep, user: Teacher,
                       runner: Annotated[Callable[[str], None], Depends(pipeline_runner)],
                       files: Annotated[list[UploadFile], File()],
                       language: Annotated[str, Form()] = "hi",
                       class_level: Annotated[int | None, Form()] = None) -> dict[str, Any]:
    """Teacher drops photos or PDFs of class notes. Returns at once; poll GET /uploads/{id}."""
    rate_limit(f"upload:{user.id}", 30, 3600)
    if not 1 <= len(files) <= MAX_FILES:
        raise HTTPException(422, f"Upload 1 to {MAX_FILES} files")
    if language not in ("hi", "kn", "en"):
        raise HTTPException(422, "language must be hi, kn or en")
    saved = []
    for f in files:
        mime = (f.content_type or "").lower()
        if mime not in ALLOWED:
            raise HTTPException(415, f"{f.filename}: use JPG, PNG, WEBP or PDF")
        data = await f.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"{f.filename} is over 10 MB")
        saved.append((storage.save(data, ALLOWED[mime]), mime))
    uid = db.execute(text("insert into uploads(teacher_id, language, class_level) values (:t,:l,:c) "
                          "returning id"), {"t": user.id, "l": language, "c": class_level}).scalar_one()
    for n, (path, mime) in enumerate(saved, start=1):
        db.execute(text("insert into upload_pages(upload_id, page_no, storage_path, mime) values "
                        "(:u,:n,:p,:m)"), {"u": uid, "n": n, "p": path, "m": mime})
    db.commit()                                   # the background job reads these rows
    background.add_task(runner, str(uid))
    return {"upload_id": str(uid), "status": "processing", "files": len(saved)}


@router.get("/uploads/{upload_id}")
def upload_status(upload_id: str, db: DbDep, user: Teacher) -> dict[str, Any]:
    row = db.execute(text(
        "select id, status, error, course_id, elapsed_ms, created_at, "
        "(select count(*) from upload_pages p where p.upload_id=u.id) as pages, "
        "(select round(avg(confidence)::numeric, 2) from upload_pages p where p.upload_id=u.id) as ocr_confidence "
        "from uploads u where id=:u and teacher_id=:t"), {"u": upload_id, "t": user.id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Upload not found")
    flagged = 0
    if row["course_id"]:
        flagged = db.execute(text(
            "select count(*) from questions q join lessons l on l.id=q.lesson_id join units un "
            "on un.id=l.unit_id where un.course_id=:c and q.flagged"), {"c": row["course_id"]}).scalar_one()
    return {**dict(row), "id": str(row["id"]), "course_id": str(row["course_id"]) if row["course_id"] else None,
            "ocr_confidence": float(row["ocr_confidence"]) if row["ocr_confidence"] is not None else None,
            "flagged_questions": flagged}


class GenerateIn(BaseModel):
    count: int = Field(6, ge=1, le=12)


@router.post("/lessons/{lesson_id}/generate")
def generate_questions(lesson_id: str, body: GenerateIn, db: DbDep, user: Teacher, model: LLMDep) -> dict[str, int]:
    course = db.execute(text("select u.course_id from lessons l join units u on u.id=l.unit_id "
                             "where l.id=:l"), {"l": lesson_id}).scalar()
    if course is None:
        raise HTTPException(404, "Lesson not found")
    own_course(db, user.id, str(course))
    rate_limit(f"gen:{user.id}", 40, 3600)
    try:
        return {"added": generate_more(db, model, lesson_id, body.count)}
    except AIUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/questions/{question_id}/regenerate")
def regenerate_question(question_id: str, db: DbDep, user: Teacher, model: LLMDep) -> dict[str, Any]:
    """Replace one question with a fresh one on the same idea and the same notes page."""
    _own_question(db, user.id, question_id)
    rate_limit(f"gen:{user.id}", 40, 3600)
    q = db.execute(text(
        "select q.lesson_id, q.position, q.concept, q.prompt, p.ocr_text, p.id as page_id, "
        "coalesce(p.confidence,1) as conf from questions q left join upload_pages p "
        "on p.id=q.source_page_id where q.id=:q"), {"q": question_id}).mappings().one()
    try:
        out = model.generate_json(
            f"Notes:\n{q['ocr_text'] or '(no notes page linked)'}\n\nWrite 1 new question about "
            f"'{q['concept'] or 'the same idea'}', different from: {json.dumps(q['prompt'], ensure_ascii=False)}",
            QUESTIONS_SCHEMA, system=SYSTEM)
    except AIUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    pages = [{"id": q["page_id"], "n": 1, "text": q["ocr_text"] or "", "confidence": q["conf"]}] if q["page_id"] else []
    new = [dict(x, source_page=1) for x in (out.get("questions") or [])[:1]]
    if not new or insert_questions(db, q["lesson_id"], new, pages, start=q["position"]) == 0:
        raise HTTPException(502, "The AI did not return a usable question. Try again.")
    db.execute(text("delete from questions where id=:q"), {"q": question_id})
    return {"ok": True}


# ---------- doubt chatbot ----------
class DoubtIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    lesson_id: str | None = None


ANSWER_SCHEMA = {"type": "OBJECT", "properties": {
    "answer": {"type": "STRING"}, "in_notes": {"type": "BOOLEAN"}, "used_page": {"type": "INTEGER"}},
    "required": ["answer", "in_notes", "used_page"]}
TUTOR = ("You are Golu, a kind cow who helps Indian school children (Classes 6 to 10) with science "
         "doubts. Answer in {lang}, then one short English line. Use ONLY the class notes given. If "
         "the notes do not cover it, say so kindly and suggest asking the teacher; set in_notes "
         "false and used_page 0. At most 80 words, simple words. Never ask for or repeat personal "
         "details. If the question is unsafe or not about studies, gently steer back to science.")
LANG = {"hi": "Hindi", "kn": "Kannada", "en": "English"}
ACCESSIBLE = ("c.status='published' and exists (select 1 from course_assignments a "
              "join memberships m on m.classroom_id=a.classroom_id where a.course_id=c.id and m.user_id=:u)")


def _def_text(d: Any, lang: str) -> str:
    if isinstance(d, dict):
        return str(d.get(lang) or d.get("en") or d.get("english") or next(iter(d.values()), ""))
    return str(d or "")


STOP = {"the", "and", "are", "for", "was", "who", "what", "why", "how", "which", "when", "where",
        "this", "that", "with", "from", "has", "have", "had", "does", "did", "can", "you", "your",
        "its", "all", "not", "but", "they", "their", "there", "into", "about", "many", "much",
        "kya", "hai", "hain", "kaise", "kyon", "aur", "mein", "का", "की", "के", "है", "हैं", "में",
        "क्या", "और", "को", "से", "कैसे", "क्यों"}


def _words(s: str) -> set[str]:
    return {w for w in re.findall(r"\w+", s.lower()) if len(w) > 2 and w not in STOP}


@router.post("/doubts")
def ask_doubt(body: DoubtIn, db: DbDep, user: Student, model: LLMDep) -> dict[str, Any]:
    """Answers from the class notes (OCR pages and terms) and cites the page. Doubt text stays private."""
    rate_limit(f"doubt:{user.id}", 30, 3600)
    lid = learner_id_for(db, user.id)
    q = body.text
    pages = db.execute(text(
        f"select p.id, p.page_no, p.ocr_text, c.title from upload_pages p join uploads up on up.id=p.upload_id "
        f"join courses c on c.id=up.course_id where {ACCESSIBLE} and p.ocr_text is not null"),
        {"u": user.id}).mappings().all()
    terms = db.execute(text(f"select t.regional, t.english, t.definition, c.title from terms t "
                            f"join courses c on c.id=t.course_id where {ACCESSIBLE}"), {"u": user.id}).mappings().all()
    qw = _words(q)
    ranked = sorted(pages, key=lambda p: len(qw & _words(p["ocr_text"])), reverse=True)[:3]
    ranked = [p for p in ranked if qw & _words(p["ocr_text"])]
    hits = [t for t in terms if t["english"].lower() in q.lower() or t["regional"] in q]
    citation: dict[str, Any] | None = None
    if ranked or hits or not get_settings().use_fake_ai:
        notes = "\n\n".join(f"[PAGE {i + 1}] ({p['title']}, page {p['page_no']})\n{p['ocr_text'][:3000]}"
                            for i, p in enumerate(ranked))
        notes += "".join(f"\n[TERM] {t['english']} ({t['regional']}): {_def_text(t['definition'], 'en')}" for t in hits)
        try:
            out = model.generate_json(f"Class notes:\n{notes or '(none found)'}\n\nStudent's doubt: {q}",
                                      ANSWER_SCHEMA, system=TUTOR.format(lang=LANG.get(user.language, "Hindi")))
        except AIUnavailable as exc:
            raise HTTPException(503, "Golu is busy right now. Please ask again in a minute.") from exc
        answer = str(out.get("answer") or "").strip()
        used = int(out.get("used_page") or 0)
        if out.get("in_notes") and 1 <= used <= len(ranked):
            p = ranked[used - 1]
            citation = {"course": p["title"], "page": p["page_no"]}
        elif out.get("in_notes") and hits:
            citation = {"course": hits[0]["title"], "term": hits[0]["english"]}
    else:
        answer = "I could not find this in your class notes yet. Ask your teacher, or try other words."
    if not answer:
        answer = "I could not find this in your class notes yet. Ask your teacher, or try other words."
    did = db.execute(text("insert into doubts(learner_id, text, lesson_id, answer, citation) "
                          "values (:l,:t,:le,:a,cast(:c as jsonb)) returning id"),
                     {"l": lid, "t": q, "le": body.lesson_id, "a": answer,
                      "c": json.dumps(citation) if citation else None}).scalar_one()
    return {"id": str(did), "answer": answer, "citation": citation}


@router.get("/doubts")
def my_doubts(db: DbDep, user: Student) -> list[dict[str, Any]]:
    rows = db.execute(text("select id, text, answer, citation, created_at from doubts "
                           "where learner_id=:l order by created_at desc limit 30"),
                      {"l": learner_id_for(db, user.id)}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


# ---------- text to speech (Listen button, parent summary) ----------
class AudioIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str = Field("hi", pattern="^(hi|kn|en)$")


@router.post("/audio")
def make_audio(body: AudioIn, db: DbDep, user: UserDep) -> dict[str, str]:
    """Cached Sarvam audio. The same text and language is only synthesised once."""
    rate_limit(f"audio:{user.id}", 120, 3600)
    try:
        audio_id = speech_cache.get_or_make(db, body.text, body.language, speech_cache.WEB_RATE)
    except Exception as exc:
        raise HTTPException(503, "Audio is not available right now.") from exc
    return {"id": str(audio_id), "url": f"/v1/audio/{audio_id}"}


@router.get("/audio/{audio_id}")
def get_audio(audio_id: str, db: DbDep) -> Response:
    """Public by unguessable id so an <audio> tag can play it without headers."""
    path = db.execute(text("select storage_path from audio_cache where id=cast(:i as uuid)"),
                      {"i": audio_id}).scalar()
    if path is None:
        raise HTTPException(404, "Audio not found")
    return Response(storage.read(path), media_type="audio/wav",
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})

