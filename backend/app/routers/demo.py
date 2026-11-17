"""Hackathon demo console API. Only exists when DEMO_MODE=true. Turn it off after the event:
/demo/login hands out the demo teacher's token without a password."""
import re
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.tokens import issue_token
from app.calls import flow
from app.calls.voice import with_voice
from app.config import get_settings
from app.demo import TEACHER_PHONE, seed_demo
from app.deps import DbDep, Teacher
from app.game import engine
from app.game import rules as r
from app.twin import model as twin


def demo_only() -> None:
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")


router = APIRouter(prefix="/demo", tags=["demo"], dependencies=[Depends(demo_only)])
page = APIRouter(dependencies=[Depends(demo_only)])
HTML = Path(__file__).resolve().parents[1] / "static" / "demo.html"


@page.get("/demo", response_class=HTMLResponse, include_in_schema=False)
def demo_page() -> str:
    return HTML.read_text(encoding="utf-8")


def _ids(db: Any) -> dict[str, Any]:
    row = db.execute(text(
        "select u.id as teacher, c.id as classroom, cs.id as cs, l.id as learner "
        "from users u join classrooms c on c.teacher_id=u.id "
        "join call_students cs on cs.classroom_id=c.id join learners l on l.call_student_id=cs.id "
        "where u.phone_e164=:p order by cs.created_at limit 1"), {"p": TEACHER_PHONE}
    ).mappings().first()
    if row is None:
        raise HTTPException(409, "Demo data missing. Run: python scripts/seed_demo.py")
    return dict(row)


@router.post("/login")
def demo_login(db: DbDep) -> dict[str, Any]:
    ids = _ids(db)
    student = db.execute(text(
        "select u.id, u.name from users u join memberships m on m.user_id=u.id "
        "where m.classroom_id=:c and u.role='student' order by u.created_at limit 1"),
        {"c": ids["classroom"]}).mappings().first()
    return {"token": issue_token(ids["teacher"], "teacher"), "classroom_id": str(ids["classroom"]),
            "call_student_id": str(ids["cs"]), "twilio_number": get_settings().twilio_number,
            # a smartphone classmate, so the console can show the student chatbot
            "student_token": issue_token(student["id"], "student") if student else None,
            "student_name": student["name"] if student else None}


@router.post("/reset")
def demo_reset(db: DbDep, _: Teacher) -> dict[str, Any]:
    s = get_settings()
    if not s.demo_phone:
        raise HTTPException(409, "Set DEMO_PHONE in backend/.env")
    return seed_demo(db, s.demo_phone, s.demo_parent_phone or s.demo_phone)


@router.get("/state")
def demo_state(db: DbDep, _: Teacher) -> dict[str, Any]:
    ids = _ids(db)
    now = engine.utcnow()
    lid, cs_id = ids["learner"], ids["cs"]
    cs = db.execute(text("select name, language, status, phone_e164 from call_students "
                         "where id=:i"), {"i": cs_id}).mappings().one()
    st = engine.load_stats(db, lid, now, lock=False)
    badges = db.execute(text(
        "select b.code, b.title->>'en' as title from badge_awards a join badges b "
        "on b.code=a.badge_code where a.learner_id=:l order by a.awarded_at"),
        {"l": lid}).mappings().all()
    concepts = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review "
                               "from twin_concepts where learner_id=:l order by concept"),
                          {"l": lid}).mappings().all()
    twin_rows = []
    for c in concepts:
        eff = twin.effective_mastery(twin.TwinState(
            c["mastery"], c["half_life_days"], c["last_seen"], c["next_review"]), now)
        twin_rows.append({"concept": c["concept"], "mastery": round(eff, 2),
                          "stars": twin.stars(eff)})
    week = r.week_start(r.ist_date(now))
    league = db.execute(text(
        "select coalesce(u.nickname, u.name, cs.name) as name, ls.xp, l.kind, ls.learner_id "
        "from league_scores ls join league_pods p on p.id=ls.pod_id "
        "join leagues g on g.id=p.league_id join learners l on l.id=ls.learner_id "
        "left join users u on u.id=l.user_id left join call_students cs on cs.id=l.call_student_id "
        "where g.classroom_id=:c and g.week_start=:w order by ls.xp desc"),
        {"c": ids["classroom"], "w": week}).mappings().all()
    table = [{"name": x["name"].split()[0], "xp": x["xp"], "is_call": x["kind"] == "call",
              "me": str(x["learner_id"]) == str(lid)} for x in league]
    if not any(t["me"] for t in table):
        table.append({"name": cs["name"], "xp": 0, "is_call": True, "me": True})
    sess = db.execute(text("select id, kind, status, state->>'lang' as lang, created_at, "
                           "seconds_used from call_sessions where call_student_id=:i "
                           "order by created_at desc limit 1"), {"i": cs_id}).mappings().first()
    events: list[dict[str, Any]] = []
    if sess:
        events = [dict(e) for e in db.execute(text(
            "select kind, payload, created_at from call_events where session_id=:s order by id"),
            {"s": sess["id"]}).mappings().all()]
    sms = db.execute(text(
        "select c.title, cc.sms_status, cc.completed_at from course_completions cc "
        "join courses c on c.id=cc.course_id where cc.learner_id=:l order by cc.completed_at"),
        {"l": lid}).mappings().all()
    phone = cs["phone_e164"]
    return {
        "student": {"name": cs["name"], "status": cs["status"], "language": cs["language"],
                    "phone": phone[:3] + "••••••" + phone[-3:], "xp": st["xp"],
                    "streak": engine.display_streak(st, now), "gems": engine.gem_balance(db, lid),
                    "stage": r.mascot_stage(st["xp"]),
                    "lessons": st["lessons_completed"]},
        "badges": [dict(b) for b in badges], "twin": twin_rows, "league": table,
        "call": dict(sess) | {"events": events} if sess else None,
        "sms": [dict(x) for x in sms], "twilio_number": get_settings().twilio_number,
        "call_student_id": str(cs_id), "classroom_id": str(ids["classroom"]),
        "courses": [dict(c) | {"id": str(c["id"])} for c in db.execute(text(
            "select c.id, c.title, c.status, "
            "(select count(*) from questions q join lessons l on l.id=q.lesson_id join units u "
            " on u.id=l.unit_id where u.course_id=c.id) as questions, "
            "(select count(*) from questions q join lessons l on l.id=q.lesson_id join units u "
            " on u.id=l.unit_id where u.course_id=c.id and q.flagged) as flagged "
            "from courses c where c.teacher_id=:t order by c.created_at desc"),
            {"t": ids["teacher"]}).mappings().all()]}


# ---------- phone simulator: "call Aaroh" from the demo console, no phone number needed ----------
SIM_STEPS = {"lang", "consent", "pick", "answer", "confirm", "voice"}


class SimIn(BaseModel):
    step: str                      # incoming | lang | consent | pick | answer | confirm | voice
    session: str | None = None
    digits: str | None = None


def twiml_to_steps(xml: str, transcript: dict[str, str] | None = None) -> dict[str, Any]:
    """Turn the call engine's TwiML into a script the browser phone can play."""
    def item(el: ET.Element) -> dict[str, Any] | None:
        if el.tag == "Say":
            return {"type": "say", "text": el.text or "", "lang": (el.get("language") or "hi-IN")}
        if el.tag == "Play":
            url = (el.text or "").strip()
            return {"type": "play", "url": url, "text": (transcript or {}).get(url, "")}
        return None

    def target(url: str) -> dict[str, str]:
        m = re.search(r"/webhooks/twilio/(\w+)\?s=([\w-]+)", url or "")
        return {"step": m.group(1), "session": m.group(2)} if m else {}

    out: dict[str, Any] = {"before": [], "gather": None, "after": [], "redirect": None, "hangup": False}
    seen_gather = False
    for el in ET.fromstring(xml):
        if el.tag == "Gather":
            seen_gather = True
            out["gather"] = {"items": [i for c in el if (i := item(c))], **target(el.get("action", ""))}
        elif el.tag == "Redirect":
            out["redirect"] = target(el.text or "")
        elif el.tag == "Hangup":
            out["hangup"] = True
        elif (i := item(el)) is not None:
            out["after" if seen_gather else "before"].append(i)
    return out


@router.post("/sim")
def simulate(body: SimIn, db: DbDep, _: Teacher) -> dict[str, Any]:
    """Runs one step of a call exactly like a Twilio webhook would, with Sarvam voices if on.

    'incoming' dials in from the demo student's phone, so caller ID finds her and her course.
    The 9 am to 9 pm rule is lifted here: nothing real is being called."""
    said: dict[str, str] = {}
    if body.step == "incoming":
        phone = db.execute(text("select phone_e164 from call_students where id=:i"),
                           {"i": _ids(db)["cs"]}).scalar_one()
        xml = with_voice(lambda d: flow.incoming(d, phone, f"SIM-{uuid.uuid4().hex[:12]}",
                                                 engine.utcnow(), enforce_hours=False), db,
                         transcript=said)
    elif body.step in SIM_STEPS and body.session:
        fn = {"lang": flow.choose_language, "consent": flow.consent, "pick": flow.pick,
              "answer": flow.answer, "confirm": flow.confirm}.get(body.step)
        xml = (with_voice(flow.voice, db, body.session, transcript=said) if fn is None
               else with_voice(fn, db, body.session, body.digits or "", transcript=said))
    else:
        raise HTTPException(422, "Unknown step")
    return twiml_to_steps(xml, said)
