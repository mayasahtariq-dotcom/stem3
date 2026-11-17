"""Call mode: teacher Call now, twin card, and Twilio webhooks (TwiML responses)."""
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import Connection, text
from starlette.concurrency import run_in_threadpool

from app.calls import flow
from app.calls.provider import TelephonyProvider
from app.calls.twilio import valid_signature
from app.config import get_settings
from app.db.session import get_db
from app.deps import DbDep, Teacher
from app.game import engine
from app.providers import get_telephony
from app.twin import model as twin

router = APIRouter(tags=["calls"])


def telephony() -> TelephonyProvider:
    return get_telephony(get_settings())


@router.post("/call-students/{cs_id}/call-now")
def call_now(cs_id: str, db: DbDep, user: Teacher,
             provider: Annotated[TelephonyProvider, Depends(telephony)]) -> dict[str, Any]:
    return flow.start_call(db, cs_id, user.id, provider, engine.utcnow())


@router.get("/call-students/{cs_id}/twin")
def call_student_twin(cs_id: str, db: DbDep, user: Teacher) -> dict[str, Any]:
    """Twin card: weak concepts and the lesson the next call will use."""
    row = db.execute(text(
        "select cs.id, cs.name, cs.language, cs.classroom_id, cs.status, l.id as learner_id "
        "from call_students cs join classrooms c on c.id=cs.classroom_id "
        "join learners l on l.call_student_id=cs.id where cs.id=:i and c.teacher_id=:t"),
        {"i": cs_id, "t": user.id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Student not found")
    now = engine.utcnow()
    concepts = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review "
                               "from twin_concepts where learner_id=:l"),
                          {"l": row["learner_id"]}).mappings().all()
    weak = sorted(({"concept": c["concept"], "mastery": round(twin.effective_mastery(
        twin.TwinState(c["mastery"], c["half_life_days"], c["last_seen"], c["next_review"]),
        now), 3)} for c in concepts), key=lambda x: float(x["mastery"]))[:5]
    plan = flow.plan_call(db, {**dict(row), "id": None})
    calls = db.execute(text(
        "select status, created_at, seconds_used from call_sessions where call_student_id=:i "
        "order by created_at desc limit 5"), {"i": cs_id}).mappings().all()
    return {"name": row["name"], "status": row["status"], "weak_concepts": weak,
            "next_lesson": plan.get("lesson_title"), "recent_calls": [dict(c) for c in calls]}


# ---------- Twilio webhooks ----------
async def _verified_form(request: Request) -> dict[str, str]:
    form = {k: str(v) for k, v in (await request.form()).items()}
    s = get_settings()
    if s.twilio_auth_token:
        public = s.public_base_url.rstrip("/") + request.url.path
        if request.url.query:
            public += "?" + request.url.query
        if not valid_signature(s.twilio_auth_token, public, form,
                               request.headers.get("X-Twilio-Signature", "")):
            raise HTTPException(403, "Bad signature")
    elif not s.use_fake_telephony:
        raise HTTPException(503, "Twilio auth token is not configured")
    return form


def _xml(body: str) -> Response:
    return Response(content=body, media_type="application/xml")


async def _run(db: Connection, fn: Callable[..., str], *args: Any) -> Response:
    return _xml(await run_in_threadpool(fn, db, *args))


DbRaw = Annotated[Connection, Depends(get_db)]


@router.post("/webhooks/twilio/voice")
async def tw_voice(request: Request, s: str, db: DbRaw) -> Response:
    await _verified_form(request)
    return await _run(db, flow.voice, s)


@router.post("/webhooks/twilio/consent")
async def tw_consent(request: Request, s: str, db: DbRaw) -> Response:
    form = await _verified_form(request)
    return await _run(db, flow.consent, s, form.get("Digits", ""))


@router.post("/webhooks/twilio/answer")
async def tw_answer(request: Request, s: str, db: DbRaw) -> Response:
    form = await _verified_form(request)
    return await _run(db, flow.answer, s, form.get("Digits", ""))


@router.post("/webhooks/twilio/status", status_code=204)
async def tw_status(request: Request, s: str, db: DbRaw) -> None:
    form = await _verified_form(request)
    await run_in_threadpool(flow.status_update, db, s, form.get("CallStatus", ""),
                            form.get("CallDuration"))
