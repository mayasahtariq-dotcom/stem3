"""Call engine: consent call and keypad lessons. Same twin, XP, streak and league as the web."""
import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.calls import twilio as tw
from app.calls.provider import TelephonyProvider
from app.calls.script import line
from app.config import get_settings
from app.game import engine, hooks, leagues
from app.game import rules as r
from app.learning.answers import check_answer
from app.people import record_consent
from app.twin import model as twin

CALL_QUESTIONS = 5
WEEKLY_CAP_SECONDS = 15 * 60
MAX_NO_INPUT = 2


def within_call_hours(now: datetime) -> bool:
    """Calls only between 9 am and 9 pm IST."""
    return 9 <= now.astimezone(r.IST).hour < 21


def _base() -> str:
    return get_settings().public_base_url.rstrip("/")


def url(path: str, session_id: str) -> str:
    return f"{_base()}/v1/webhooks/twilio/{path}?s={session_id}"


def _text(v: Any) -> str:
    if isinstance(v, dict):
        return str(v.get("regional") or v.get("english") or "")
    return str(v)


# ---------- starting a call ----------
def start_call(db: Connection, cs_id: str, teacher_id: str, provider: TelephonyProvider,
               now: datetime) -> dict[str, Any]:
    cs = db.execute(text(
        "select cs.id, cs.phone_e164, cs.parent_phone_e164, cs.status, l.id as learner_id "
        "from call_students cs join classrooms c on c.id=cs.classroom_id "
        "join learners l on l.call_student_id=cs.id where cs.id=:i and c.teacher_id=:t"),
        {"i": cs_id, "t": teacher_id}).mappings().first()
    if cs is None:
        raise HTTPException(404, "Student not found")
    if get_settings().call_hours_enforced and not within_call_hours(now):
        raise HTTPException(409, "Calls are only allowed between 9 am and 9 pm IST")
    if cs["status"] in ("declined", "paused"):
        raise HTTPException(409, f"Calls are {cs['status']} for this student")
    used = db.execute(text(
        "select coalesce(sum(seconds_used),0) from call_sessions where call_student_id=:i "
        "and created_at >= :w"),
        {"i": cs_id, "w": datetime.combine(r.week_start(r.ist_date(now)), datetime.min.time(),
                                           tzinfo=r.IST)}).scalar_one()
    if used >= WEEKLY_CAP_SECONDS:
        raise HTTPException(409, "Weekly call minutes are used up")
    if cs["status"] == "waiting_consent":
        kind, to = "consent", cs["parent_phone_e164"] or cs["phone_e164"]
    else:
        consented = db.execute(text("select granted from consent_records where learner_id=:l "
                                    "order by created_at desc limit 1"),
                               {"l": cs["learner_id"]}).scalar()
        if not consented:
            raise HTTPException(409, "No consent on record; this number is never called")
        kind, to = "lesson", cs["phone_e164"]
    sid = db.execute(text(
        "insert into call_sessions(call_student_id, scheduled_for, status, kind, learner_id) "
        "values (:c,:n,'ringing',:k,:l) returning id"),
        {"c": cs_id, "n": now, "k": kind, "l": cs["learner_id"]}).scalar_one()
    _event(db, sid, "placed", {"kind": kind})
    try:
        provider_id = provider.place_call(to, str(sid))
    except Exception as exc:
        db.execute(text("update call_sessions set status='failed' where id=:s"), {"s": sid})
        db.commit()
        raise HTTPException(502, "The phone provider could not place the call") from exc
    db.execute(text("update call_sessions set provider_call_id=:p where id=:s"),
               {"p": provider_id, "s": sid})
    return {"session_id": str(sid), "kind": kind, "status": "ringing"}


def _event(db: Connection, sid: Any, kind: str, payload: dict[str, Any]) -> None:
    db.execute(text("insert into call_events(session_id, kind, payload) values "
                    "(:s,:k,cast(:p as jsonb))"), {"s": sid, "k": kind, "p": json.dumps(payload)})


def load_session(db: Connection, sid: str) -> dict[str, Any]:
    row = db.execute(text(
        "select s.id, s.kind, s.state, s.status, s.learner_id, cs.id as cs_id, cs.name, "
        "cs.language, cs.classroom_id from call_sessions s "
        "join call_students cs on cs.id=s.call_student_id where s.id=:s for update of s"),
        {"s": sid}).mappings().first()
    if row is None:
        raise HTTPException(404, "Unknown call")
    return dict(row)


def save_state(db: Connection, sid: Any, state: dict[str, Any], status: str | None = None) -> None:
    db.execute(text("update call_sessions set state=cast(:st as jsonb), "
                    "status=coalesce(:status, status) where id=:s"),
               {"st": json.dumps(state), "status": status, "s": sid})


# ---------- choosing what to teach ----------
def plan_call(db: Connection, sess: dict[str, Any]) -> dict[str, Any]:
    """Twin picks: a warm-up the student got wrong last time, then the next unfinished lesson."""
    lid = sess["learner_id"]
    lesson = db.execute(text(
        "select l.id, l.title from courses c join course_assignments a on a.course_id=c.id "
        "join units u on u.course_id=c.id join lessons l on l.unit_id=u.id "
        "where a.classroom_id=:k and c.status='published' "
        "and exists (select 1 from questions q where q.lesson_id=l.id and q.call_safe "
        "and q.kind in ('mcq','true_false')) "
        "and not exists (select 1 from lesson_progress p where p.lesson_id=l.id "
        "and p.learner_id=:l and p.completed_at is not null) "
        "order by c.title, u.position, l.position limit 1"),
        {"k": sess["classroom_id"], "l": lid}).mappings().first()
    if lesson is None:
        return {"queue": []}
    qs = db.execute(text("select id from questions where lesson_id=:le and call_safe and "
                         "kind in ('mcq','true_false') order by id limit :n"),
                    {"le": lesson["id"], "n": CALL_QUESTIONS}).scalars().all()
    warm = db.execute(text(
        "select a.question_id from answer_attempts a join questions q on q.id=a.question_id "
        "where a.learner_id=:l and not a.correct and q.call_safe and q.lesson_id <> :le "
        "order by a.created_at desc limit 1"), {"l": lid, "le": lesson["id"]}).scalar()
    queue = ([str(warm)] if warm else []) + [str(q) for q in qs]
    return {"queue": queue, "i": 0, "xp": 0, "combo": 0, "bonus": 0, "seen": {},
            "badges": [], "noinput": 0, "lesson_id": str(lesson["id"]),
            "lesson_title": lesson["title"], "lesson_qs": [str(q) for q in qs]}


# ---------- TwiML builders ----------
def ask(db: Connection, sess: dict[str, Any], state: dict[str, Any], first: bool) -> str:
    lang = sess["language"]
    q = db.execute(text("select kind, prompt, options from questions where id=:q"),
                   {"q": state["queue"][state["i"]]}).mappings().one()
    parts = [tw.say(_text(q["prompt"]), lang)]
    if q["kind"] == "true_false":
        parts.append(tw.say(line(lang, "true_false"), lang))
    else:
        for n, opt in enumerate(q["options"] or [], start=1):
            parts.append(tw.say(line(lang, "option", n=n, text=_text(opt)), lang))
    if first:
        parts.append(tw.say(line(lang, "hint"), lang))
    sid = str(sess["id"])
    return (tw.gather("".join(parts), url("answer", sid))
            + tw.say(line(lang, "no_input"), lang) + tw.redirect(url("voice", sid)))


def voice(db: Connection, sid: str) -> str:
    """Entry point when the call is answered, and the re-ask target after silence."""
    sess = load_session(db, sid)
    lang, state = sess["language"], dict(sess["state"] or {})
    if sess["kind"] == "consent" and not state.get("consented"):
        if state.get("asked_consent"):
            state["noinput"] = state.get("noinput", 0) + 1
            if state["noinput"] > MAX_NO_INPUT:
                save_state(db, sess["id"], state)
                return tw.response(tw.HANGUP)
        state["asked_consent"] = True
        save_state(db, sess["id"], state, "answered")
        return tw.response(tw.gather(tw.say(line(lang, "consent", name=sess["name"]), lang),
                                     url("consent", sid)),
                           tw.redirect(url("voice", sid)))
    if "queue" not in state:
        return start_lesson(db, sess)
    state["noinput"] = state.get("noinput", 0) + 1
    if state["noinput"] > MAX_NO_INPUT:
        return finish(db, sess, state, [])
    save_state(db, sess["id"], state)
    return tw.response(ask(db, sess, state, first=False))


def start_lesson(db: Connection, sess: dict[str, Any], intro: list[str] | None = None) -> str:
    lang = sess["language"]
    state = {**dict(sess["state"] or {}), **plan_call(db, sess)}
    parts = list(intro or [])
    if not state["queue"]:
        save_state(db, sess["id"], state, "answered")
        return tw.response(*parts, tw.say(line(lang, "no_lesson"), lang), tw.HANGUP)
    now = engine.utcnow()
    st = engine.load_stats(db, sess["learner_id"], now, lock=False)
    parts.append(tw.say(line(lang, "greet", name=sess["name"].split()[0],
                             streak=engine.display_streak(st, now),
                             lesson=state["lesson_title"]), lang))
    save_state(db, sess["id"], state, "answered")
    _event(db, sess["id"], "lesson_started", {"questions": len(state["queue"])})
    return tw.response(*parts, ask(db, sess, state, first=True))


def consent(db: Connection, sid: str, digit: str) -> str:
    sess = load_session(db, sid)
    lang, state = sess["language"], dict(sess["state"] or {})
    if digit == "1":
        record_consent(db, sess["learner_id"], "parent_keypress", True)
        state["consented"] = True
        save_state(db, sess["id"], state)
        _event(db, sess["id"], "consent", {"granted": True})
        sess["state"] = state
        return start_lesson(db, sess, [tw.say(line(lang, "consent_yes"), lang)])
    if digit == "2":
        record_consent(db, sess["learner_id"], "parent_keypress", False)
        _event(db, sess["id"], "consent", {"granted": False})
        save_state(db, sess["id"], {**state, "consented": False}, "completed")
        return tw.response(tw.say(line(lang, "consent_no"), lang), tw.HANGUP)
    return tw.response(tw.redirect(url("voice", sid)))


# ---------- answering ----------
def record_call_answer(db: Connection, sess: dict[str, Any], state: dict[str, Any], qid: str,
                       chosen: Any, now: datetime) -> dict[str, Any]:
    lid = sess["learner_id"]
    q = db.execute(text("select kind, answer, concept, lesson_id from questions where id=:q"),
                   {"q": qid}).mappings().one()
    first_try = state["seen"].get(qid, 0) == 0
    state["seen"][qid] = state["seen"].get(qid, 0) + 1
    correct = check_answer(q["kind"], q["answer"], chosen)
    st = engine.load_stats(db, lid, now)
    state["combo"] = state["combo"] + 1 if correct else 0
    xp = bonus = 0
    if correct:
        xp = r.xp_for_answer(True, first_try)
        bonus = r.combo_bonus(state["combo"], state["bonus"])
        state["bonus"] += bonus
    total = xp + bonus
    st["play_seconds_today"] += r.play_seconds_since(st["last_activity_at"], now)
    st["last_activity_at"] = now
    st["best_combo"] = max(st["best_combo"], state["combo"])
    engine.grant_xp(st, total, now)              # hearts never block or drop on calls
    engine.save_stats(db, lid, st)
    db.execute(text(
        "insert into answer_attempts(learner_id, question_id, correct, first_try, channel, "
        "lesson_id, xp, chosen) values (:l,:q,:c,:f,'call',:le,:x,cast(:ch as jsonb))"),
        {"l": lid, "q": qid, "c": correct, "f": first_try, "le": q["lesson_id"], "x": total,
         "ch": json.dumps(chosen)})
    concept = q["concept"] or str(q["lesson_id"])
    was_due = twin.needs_revision(engine.twin_state(db, lid, concept), now)
    engine.save_twin(db, lid, concept,
                     twin.update(engine.twin_state(db, lid, concept), correct, first_try, now))
    if not correct:
        engine.record_confusion(db, lid, concept, chosen)
    ctx: dict[str, Any] = {
        "db": db, "lid": lid, "now": now, "correct": correct, "xp": total,
        "counts_for_league": st["play_seconds_today"] <= r.SOFT_LIMIT_SECONDS and total > 0,
        "combo": state["combo"], "combo_hit": correct and state["combo"] % r.COMBO_STEP == 0,
        "was_due": was_due, "comeback": False, "extras": {}, "stats": st}
    hooks.run(hooks.ON_ATTEMPT, ctx)
    engine.save_stats(db, lid, st)
    state["xp"] += total
    state["badges"] += ctx["extras"].get("badges", [])
    return {"correct": correct, "xp": total, "answer": q["answer"], "kind": q["kind"],
            "combo_hit": ctx["combo_hit"]}


def answer(db: Connection, sid: str, digit: str) -> str:
    sess = load_session(db, sid)
    lang, state = sess["language"], dict(sess["state"] or {})
    if "queue" not in state or state["i"] >= len(state["queue"]):
        return tw.response(tw.HANGUP)
    state["noinput"] = 0
    qid = state["queue"][state["i"]]
    if digit in ("9", "0"):                     # repeat (0 = simpler explanation, not yet built)
        save_state(db, sess["id"], state)
        return tw.response(ask(db, sess, state, first=False))
    if digit == "#":                            # skip
        state["i"] += 1
        return _next(db, sess, state, [])
    q = db.execute(text("select kind, options from questions where id=:q"),
                   {"q": qid}).mappings().one()
    if q["kind"] == "true_false":
        chosen: Any = {"1": True, "2": False}.get(digit)
    else:
        opts = q["options"] or []
        n = int(digit) if digit.isdigit() else 0
        chosen = _text(opts[n - 1]) if 1 <= n <= len(opts) else None
    if chosen is None:
        save_state(db, sess["id"], state)
        return tw.response(ask(db, sess, state, first=False))
    res = record_call_answer(db, sess, state, qid, chosen, engine.utcnow())
    if res["correct"]:
        parts = [tw.say(line(lang, "correct", xp=res["xp"]), lang)]
        if res["combo_hit"]:
            parts.append(tw.say(line(lang, "combo"), lang))
    else:
        ans = res["answer"]
        if res["kind"] == "true_false":
            ans = line(lang, "true" if ans in (True, "true", "True") else "false")
        parts = [tw.say(line(lang, "not_quite", answer=_text(ans)), lang)]
    state["i"] += 1
    return _next(db, sess, state, parts)


def _next(db: Connection, sess: dict[str, Any], state: dict[str, Any], parts: list[str]) -> str:
    if state["i"] < len(state["queue"]):
        save_state(db, sess["id"], state)
        return tw.response(*parts, ask(db, sess, state, first=False))
    return finish(db, sess, state, parts)


def finish(db: Connection, sess: dict[str, Any], state: dict[str, Any], parts: list[str]) -> str:
    lang, lid, now = sess["language"], sess["learner_id"], engine.utcnow()
    st = engine.load_stats(db, lid, now)
    lesson_id = state.get("lesson_id")
    if lesson_id and state.get("lesson_qs"):
        right = db.execute(text(
            "select count(distinct question_id) from answer_attempts where learner_id=:l "
            "and channel='call' and correct and question_id = any(cast(:qs as uuid[]))"),
            {"l": lid, "qs": state["lesson_qs"]}).scalar_one()
        if right >= len(state["lesson_qs"]):
            first_time = db.execute(text(
                "select completed_at is null from lesson_progress where learner_id=:l and "
                "lesson_id=:le"), {"l": lid, "le": lesson_id}).scalar()
            first_time = True if first_time is None else bool(first_time)
            db.execute(text(
                "insert into lesson_progress(learner_id, lesson_id, status, completed_at) "
                "values (:l,:le,'completed',:n) on conflict (learner_id, lesson_id) do update "
                "set status='completed', completed_at=:n"), {"l": lid, "le": lesson_id, "n": now})
            engine.grant_xp(st, r.XP_LESSON, now)
            state["xp"] += r.XP_LESSON
            if first_time:
                engine.add_gems(db, lid, r.GEMS_LESSON, "lesson")
                st["lessons_completed"] += 1
            ctx: dict[str, Any] = {
                "db": db, "lid": lid, "now": now, "xp": r.XP_LESSON, "first_time": first_time,
                "perfect": False, "counts_for_league": True, "lesson_id": lesson_id,
                "extras": {}, "stats": st, "comeback": False}
            hooks.run(hooks.ON_COMPLETE, ctx)
            state["badges"] += ctx["extras"].get("badges", [])
    engine.save_stats(db, lid, st)
    parts = [*parts, tw.say(line(lang, "summary", xp=state["xp"],
                                 streak=engine.display_streak(st, now)), lang)]
    if state["badges"]:
        parts.append(tw.say(line(lang, "badge"), lang))
    rank = leagues.standings(db, lid, st["league_tier"], now).get("rank")
    if rank:
        parts.append(tw.say(line(lang, "rank", rank=rank), lang))
    parts.append(tw.say(line(lang, "bye"), lang))
    state["done"] = True
    save_state(db, sess["id"], state)
    _event(db, sess["id"], "finished", {"xp": state["xp"]})
    return tw.response(*parts, tw.HANGUP)


def status_update(db: Connection, sid: str, call_status: str, duration: str | None) -> None:
    mapped = {"completed": "completed", "busy": "missed", "no-answer": "missed",
              "failed": "failed", "canceled": "failed"}.get(call_status)
    if mapped is None:
        return
    db.execute(text("update call_sessions set status = case when :m='completed' and "
                    "status='ringing' then 'missed' else :m end, seconds_used=:d, ended_at=now() "
                    "where id=:s"),
               {"m": mapped, "d": int(duration or 0), "s": sid})
    _event(db, sid, "status", {"status": call_status})
