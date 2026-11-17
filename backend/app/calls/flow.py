"""Call engine: consent call and keypad lessons. Same twin, XP, streak and league as the web."""
import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.calls import twilio as tw
from app.calls.provider import TelephonyProvider
from app.calls.script import UNKNOWN_CALLER, line
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


def _text(v: Any, lang: str = "hi") -> str:
    """Pick the right language from {hi|kn|en|regional|english} content, else the plain text."""
    if isinstance(v, dict):
        pref = v.get(lang) or (v.get("english") if lang == "en" else v.get("regional"))
        return str(pref or v.get("regional") or v.get("english") or "")
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
    if minutes_used_up(db, cs_id, now):
        raise HTTPException(409, "Weekly call minutes are used up")
    if cs["status"] == "waiting_consent":
        kind, to = "consent", cs["parent_phone_e164"] or cs["phone_e164"]
    else:
        if not consent_on_record(db, cs["learner_id"]):
            raise HTTPException(409, "No consent on record; this number is never called")
        kind, to = "lesson", cs["phone_e164"]
    sid = new_session(db, cs_id, cs["learner_id"], kind, now, "ringing")
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


def minutes_used_up(db: Connection, cs_id: Any, now: datetime) -> bool:
    used = db.execute(text(
        "select coalesce(sum(seconds_used),0) from call_sessions where call_student_id=:i "
        "and created_at >= :w"),
        {"i": cs_id, "w": datetime.combine(r.week_start(r.ist_date(now)), datetime.min.time(),
                                           tzinfo=r.IST)}).scalar_one()
    return bool(used >= WEEKLY_CAP_SECONDS)


def consent_on_record(db: Connection, learner_id: Any) -> bool:
    return bool(db.execute(text("select granted from consent_records where learner_id=:l "
                                "order by created_at desc limit 1"), {"l": learner_id}).scalar())


def new_session(db: Connection, cs_id: Any, learner_id: Any, kind: str, now: datetime,
                status: str, provider_id: str | None = None) -> Any:
    return db.execute(text(
        "insert into call_sessions(call_student_id, scheduled_for, status, kind, learner_id, "
        "provider_call_id) values (:c,:n,:st,:k,:l,:p) returning id"),
        {"c": cs_id, "n": now, "st": status, "k": kind, "l": learner_id,
         "p": provider_id}).scalar_one()


# ---------- incoming calls: caller ID -> student -> twin picks the course ----------
def incoming(db: Connection, from_number: str, call_sid: str, now: datetime,
             enforce_hours: bool = True) -> str:
    """A student calls our number. Match the caller to call-only students by phone.

    Unknown numbers get no learner data. Siblings sharing a phone pick with a key press.
    """
    rows = db.execute(text(
        "select cs.id, cs.name, cs.language, cs.status, l.id as learner_id from call_students cs "
        "join learners l on l.call_student_id=cs.id where cs.phone_e164=:p "
        "order by cs.created_at"), {"p": from_number}).mappings().all()
    if not rows:
        return tw.response(tw.say(UNKNOWN_CALLER, "en"), tw.HANGUP)
    lang = rows[0]["language"]
    if enforce_hours and get_settings().call_hours_enforced and not within_call_hours(now):
        return tw.response(tw.say(line(lang, "closed"), lang), tw.HANGUP)
    if len(rows) == 1:
        return begin_incoming(db, dict(rows[0]), call_sid, now)
    first = rows[0]
    sid = new_session(db, first["id"], first["learner_id"], "lesson", now, "answered", call_sid)
    save_state(db, sid, {"pick": [str(x["id"]) for x in rows]})
    prompt = "".join(tw.say(line(x["language"], "pick", n=i, name=x["name"].split()[0]),
                            x["language"]) for i, x in enumerate(rows, start=1))
    return tw.response(tw.gather(prompt, url("pick", str(sid))), tw.HANGUP)


def begin_incoming(db: Connection, cs: dict[str, Any], call_sid: str, now: datetime,
                   sid: Any = None) -> str:
    lang = cs["language"]
    if cs["status"] in ("declined", "paused"):
        return tw.response(tw.say(line(lang, "not_active"), lang), tw.HANGUP)
    if minutes_used_up(db, cs["id"], now):
        return tw.response(tw.say(line(lang, "cap"), lang), tw.HANGUP)
    kind = "lesson" if consent_on_record(db, cs["learner_id"]) else "consent"
    if sid is None:
        sid = new_session(db, cs["id"], cs["learner_id"], kind, now, "answered", call_sid)
    else:
        db.execute(text("update call_sessions set call_student_id=:c, learner_id=:l, kind=:k, "
                        "state='{}'::jsonb where id=:s"),
                   {"c": cs["id"], "l": cs["learner_id"], "k": kind, "s": sid})
    _event(db, sid, "incoming", {"kind": kind})
    return voice(db, str(sid))


def pick(db: Connection, sid: str, digit: str) -> str:
    sess = load_session(db, sid)
    ids = (sess["state"] or {}).get("pick", [])
    n = int(digit) if digit.isdigit() else 0
    if not 1 <= n <= len(ids):
        return tw.response(tw.HANGUP)
    cs = db.execute(text(
        "select cs.id, cs.name, cs.language, cs.status, l.id as learner_id from call_students cs "
        "join learners l on l.call_student_id=cs.id where cs.id=:i"),
        {"i": ids[n - 1]}).mappings().one()
    return begin_incoming(db, dict(cs), "", engine.utcnow(), sid=sess["id"])


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
                         "kind in ('mcq','true_false') order by position, id limit :n"),
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
LANG_KEYS = {"1": "hi", "2": "kn", "3": "en"}


def lang_of(sess: dict[str, Any], state: dict[str, Any]) -> str:
    """The language chosen on this call (press 1/2/3), else the student's default."""
    return str(state.get("lang") or sess["language"])


def option_choices(q: Any, lang: str) -> list[tuple[Any, str]]:
    """(value checked against the answer, label spoken to the child) for each key 1..n."""
    if q["kind"] == "true_false":
        return [(True, line(lang, "true")), (False, line(lang, "false"))]
    return [(o, _text(o, lang)) for o in (q["options"] or [])]


def language_menu(sid: str) -> str:
    menu = "".join(tw.say(line(code, "lang_menu"), code) for code in ("hi", "kn", "en"))
    return tw.gather(menu, url("lang", sid)) + tw.redirect(url("voice", sid))


def ask(db: Connection, sess: dict[str, Any], state: dict[str, Any]) -> str:
    """Question, then 'press 1 for…, press 2 for…', then the next key repeats the question."""
    lang = lang_of(sess, state)
    q = db.execute(text("select kind, prompt, options from questions where id=:q"),
                   {"q": state["queue"][state["i"]]}).mappings().one()
    choices = option_choices(q, lang)
    parts = [tw.say(_text(q["prompt"], lang), lang)]
    parts += [tw.say(line(lang, "option", n=n, text=label), lang)
              for n, (_, label) in enumerate(choices, start=1)]
    parts.append(tw.say(line(lang, "repeat", n=len(choices) + 1), lang))
    sid = str(sess["id"])
    return (tw.gather("".join(parts), url("answer", sid))
            + tw.say(line(lang, "no_input"), lang) + tw.redirect(url("voice", sid)))


def confirm_menu(sess: dict[str, Any], state: dict[str, Any]) -> str:
    lang, sid = lang_of(sess, state), str(sess["id"])
    return (tw.gather(tw.say(line(lang, "chosen", text=state["pending"]["label"]), lang),
                      url("confirm", sid))
            + tw.say(line(lang, "no_input"), lang) + tw.redirect(url("voice", sid)))


def voice(db: Connection, sid: str) -> str:
    """Entry point when the call is answered, and the re-ask target after silence."""
    sess = load_session(db, sid)
    state = dict(sess["state"] or {})
    if "lang" not in state:                       # 1 Hindi, 2 Kannada, 3 English
        if state.get("asked_lang"):
            state["noinput"] = state.get("noinput", 0) + 1
            if state["noinput"] > MAX_NO_INPUT:
                save_state(db, sess["id"], state)
                return tw.response(tw.HANGUP)
        state["asked_lang"] = True
        save_state(db, sess["id"], state, "answered")
        return tw.response(language_menu(sid))
    lang = lang_of(sess, state)
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
    state.pop("pending", None)
    state["noinput"] = state.get("noinput", 0) + 1
    if state["noinput"] > MAX_NO_INPUT:
        return finish(db, sess, state, [])
    save_state(db, sess["id"], state)
    return tw.response(ask(db, sess, state))


def choose_language(db: Connection, sid: str, digit: str) -> str:
    sess = load_session(db, sid)
    chosen = LANG_KEYS.get(digit)
    if chosen is None:
        return tw.response(tw.redirect(url("voice", sid)))
    state = {**dict(sess["state"] or {}), "lang": chosen, "noinput": 0}
    save_state(db, sess["id"], state)
    _event(db, sess["id"], "language", {"lang": chosen})
    return voice(db, sid)


def start_lesson(db: Connection, sess: dict[str, Any], intro: list[str] | None = None) -> str:
    state = {**dict(sess["state"] or {}), **plan_call(db, sess)}
    lang = lang_of(sess, state)
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
    return tw.response(*parts, ask(db, sess, state))


def consent(db: Connection, sid: str, digit: str) -> str:
    sess = load_session(db, sid)
    state = dict(sess["state"] or {})
    lang = lang_of(sess, state)
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
    q = db.execute(text("select kind, answer, concept, lesson_id, prompt from questions "
                        "where id=:q"), {"q": qid}).mappings().one()
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
            "combo_hit": ctx["combo_hit"], "prompt": q["prompt"]}


def answer(db: Connection, sid: str, digit: str) -> str:
    """A key on the question menu: an option (then confirm), repeat, or # to skip."""
    sess = load_session(db, sid)
    state = dict(sess["state"] or {})
    if "queue" not in state or state["i"] >= len(state["queue"]):
        return tw.response(tw.HANGUP)
    state["noinput"] = 0
    state.pop("pending", None)
    q = db.execute(text("select kind, options from questions where id=:q"),
                   {"q": state["queue"][state["i"]]}).mappings().one()
    choices = option_choices(q, lang_of(sess, state))
    if digit == "#":                              # skip
        state["i"] += 1
        return _next(db, sess, state, [])
    n = int(digit) if digit.isdigit() else 0
    if not 1 <= n <= len(choices):                # the repeat key, 9, 0 or anything else
        save_state(db, sess["id"], state)
        return tw.response(ask(db, sess, state))
    value, label = choices[n - 1]
    state["pending"] = {"value": value, "label": label}
    save_state(db, sess["id"], state)
    return tw.response(confirm_menu(sess, state))


def confirm(db: Connection, sid: str, digit: str) -> str:
    """'You chose X. Press 1 to confirm, 2 to hear the question again.' Only 1 records it."""
    sess = load_session(db, sid)
    state = dict(sess["state"] or {})
    lang = lang_of(sess, state)
    pending = state.get("pending")
    if "queue" not in state or pending is None or state["i"] >= len(state["queue"]):
        return tw.response(tw.redirect(url("voice", sid)))
    state["noinput"] = 0
    if digit == "2":
        state.pop("pending", None)
        save_state(db, sess["id"], state)
        return tw.response(ask(db, sess, state))
    if digit != "1":
        save_state(db, sess["id"], state)
        return tw.response(confirm_menu(sess, state))
    state.pop("pending", None)
    res = record_call_answer(db, sess, state, state["queue"][state["i"]], pending["value"],
                             engine.utcnow())
    _event(db, sess["id"], "answer", {
        "question": _text(res["prompt"], "en"), "chosen": _text(pending["value"], "en")
        if not isinstance(pending["value"], bool) else ("True" if pending["value"] else "False"),
        "correct": res["correct"], "xp": res["xp"], "combo": res["combo_hit"]})
    if res["correct"]:
        parts = [tw.say(line(lang, "correct", xp=res["xp"]), lang)]
        if res["combo_hit"]:
            parts.append(tw.say(line(lang, "combo"), lang))
    else:
        ans = res["answer"]
        if res["kind"] == "true_false":
            label = line(lang, "true" if ans in (True, "true", "True") else "false")
        else:
            label = _text(ans, lang)
        parts = [tw.say(line(lang, "not_quite", answer=label), lang)]
    state["i"] += 1
    return _next(db, sess, state, parts)


def _next(db: Connection, sess: dict[str, Any], state: dict[str, Any], parts: list[str]) -> str:
    if state["i"] < len(state["queue"]):
        save_state(db, sess["id"], state)
        return tw.response(*parts, ask(db, sess, state))
    return finish(db, sess, state, parts)


def finish(db: Connection, sess: dict[str, Any], state: dict[str, Any], parts: list[str]) -> str:
    lang, lid, now = lang_of(sess, state), sess["learner_id"], engine.utcnow()
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


def status_update(db: Connection, sid: str | None, call_status: str, duration: str | None,
                  call_sid: str = "") -> None:
    if sid is None:
        found = db.execute(text("select id from call_sessions where provider_call_id=:p "
                                "order by created_at desc limit 1"), {"p": call_sid}).scalar()
        if found is None:
            return
        sid = str(found)
    mapped = {"completed": "completed", "busy": "missed", "no-answer": "missed",
              "failed": "failed", "canceled": "failed"}.get(call_status)
    if mapped is None:
        return
    db.execute(text("update call_sessions set status = case when :m='completed' and "
                    "status='ringing' then 'missed' else :m end, seconds_used=:d, ended_at=now() "
                    "where id=:s"),
               {"m": mapped, "d": int(duration or 0), "s": sid})
    _event(db, sid, "status", {"status": call_status})
