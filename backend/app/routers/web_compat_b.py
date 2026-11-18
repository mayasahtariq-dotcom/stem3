"""Web app compatibility, part B: game, call console, teacher and parent screens (mounted at /web).

Same idea as web_compat.py: the web app's contract (packages/api-client) on top of this backend's
real logic. Ids the web app sees: classroom/course/lesson/question ids are ours; a "student"
in teacher screens is the user id; a "child" in parent screens is the learner id."""
import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app import storage
from app.calls import flow
from app.calls.provider import TelephonyProvider
from app.deps import DbDep, UserDep, has_consent
from app.game import engine, leagues
from app.game import rules as r
from app.game.awards import OUTFITS, open_pot
from app.game.quests import list_quests
from app.people import create_learner, record_consent
from app.routers import ai as ai_routes
from app.routers.auth import UserOut
from app.routers.calls import telephony
from app.routers.teacher import class_key, make_link_code
from app.routers.web_compat import (
    SUBJECT_CODE,
    _lid,
    _media,
    iso,
    question_out,
    term_content,
    term_key,
    tri,
)
from app.twin import model as twin
from app.twin import read as twin_read

router = APIRouter(prefix="/web", tags=["web-compat"])
CODE_SUBJECT = {v: k for k, v in SUBJECT_CODE.items()}
BLANK = {"en": "", "hi": "", "kn": ""}


def _teacher(user: UserOut) -> None:
    if user.role not in ("teacher", "admin"):
        raise HTTPException(403, {"code": "FORBIDDEN"})


def _parent(user: UserOut) -> None:
    if user.role != "parent":
        raise HTTPException(403, {"code": "FORBIDDEN"})


def _week_end(now: datetime) -> str:
    monday = r.week_start(r.ist_date(now)) + timedelta(days=7)
    return datetime.combine(monday, datetime.min.time(), tzinfo=r.IST).astimezone(UTC).isoformat()


# =====================================================================================
# GAME
# =====================================================================================
OUTFIT_NAMES = {"bow": ("Bow", "बो", "ಬಿಲ್ಲು ಗಂಟು"), "cap": ("Cap", "टोपी", "ಟೋಪಿ"), "scarf": ("Scarf", "दुपट्टा", "ಸ್ಕಾರ್ಫ್"),
                "glasses": ("Glasses", "चश्मा", "ಕನ್ನಡಕ"), "medal": ("Medal", "पदक", "ಪದಕ"), "cape": ("Cape", "केप", "ಕೇಪ್")}


def game_stats(db: Connection, lid: Any) -> dict[str, Any]:
    now = engine.utcnow()
    st = engine.load_stats(db, lid, now, lock=False)
    m = db.execute(text("select stage, outfit from mascot_state where learner_id=:l"), {"l": lid}).mappings().one()
    outfit = dict(m["outfit"] or {})
    nxt = next((t for t in (r.STAGE_COW_XP, r.STAGE_CHAMPION_XP) if st["xp"] < t), None)
    pots = db.execute(text("select id from pot_opens where learner_id=:l and opened_at is null order by id"),
                      {"l": lid}).scalars().all()
    return {"gems": engine.gem_balance(db, lid), "freezes": st["freezes"], "max_freezes": r.MAX_FREEZES,
            "freeze_cost": r.FREEZE_COST,
            "mascot": {"stage": r.mascot_stage(st["xp"]), "xp_total": st["xp"], "next_stage_xp": nxt,
                       "outfit": outfit.get("equipped")},
            "owned": list(outfit.get("owned", [])), "pending_pots": [str(p) for p in pots]}


@router.get("/game/stats")
def g_stats(db: DbDep, user: UserDep) -> dict[str, Any]:
    return game_stats(db, _lid(db, user))


@router.post("/game/freeze")
def g_freeze(db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    st = engine.load_stats(db, lid, engine.utcnow())
    if st["freezes"] >= r.MAX_FREEZES:
        raise HTTPException(409, {"code": "MAX_FREEZES"})
    if engine.gem_balance(db, lid) < r.FREEZE_COST:
        raise HTTPException(409, {"code": "NOT_ENOUGH_GEMS"})
    engine.add_gems(db, lid, -r.FREEZE_COST, "streak_freeze")
    st["freezes"] += 1
    engine.save_stats(db, lid, st)
    return game_stats(db, lid)


@router.get("/game/shop")
def g_shop(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    owned = game_stats(db, _lid(db, user))["owned"]
    return [{"id": o, "kind": "outfit", "name": dict(zip(("en", "hi", "kn"), OUTFIT_NAMES[o], strict=True)),
             "icon": o, "price": r.OUTFIT_COST, "owned": o in owned} for o in OUTFITS]


@router.post("/game/shop/{item}/buy")
def g_buy(item: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    if item not in OUTFITS:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    outfit = dict(db.execute(text("select outfit from mascot_state where learner_id=:l for update"),
                             {"l": lid}).scalar_one() or {})
    owned = list(outfit.get("owned", []))
    if item in owned:
        raise HTTPException(409, {"code": "ALREADY_OWNED"})
    if engine.gem_balance(db, lid) < r.OUTFIT_COST:
        raise HTTPException(409, {"code": "NOT_ENOUGH_GEMS"})
    engine.add_gems(db, lid, -r.OUTFIT_COST, f"outfit:{item}")
    outfit["owned"] = [*owned, item]
    db.execute(text("update mascot_state set outfit=cast(:o as jsonb) where learner_id=:l"),
               {"o": json.dumps(outfit), "l": lid})
    return game_stats(db, lid)


class EquipIn(BaseModel):
    outfit: str | None = None


@router.put("/game/mascot/outfit")
def g_equip(body: EquipIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    outfit = dict(db.execute(text("select outfit from mascot_state where learner_id=:l for update"),
                             {"l": lid}).scalar_one() or {})
    if body.outfit is not None and body.outfit not in outfit.get("owned", []):
        raise HTTPException(409, {"code": "NOT_OWNED"})
    outfit["equipped"] = body.outfit
    db.execute(text("update mascot_state set outfit=cast(:o as jsonb) where learner_id=:l"),
               {"o": json.dumps(outfit), "l": lid})
    return game_stats(db, lid)


QUEST_KIND = {"answer_10": "answer_questions", "combo_3": "combo", "lesson_1": "finish_lessons",
              "lessons_5": "finish_lessons", "revision_5": "answer_questions"}
QUEST_TITLE = {"answer_10": ("Answer 10 questions", "10 सवालों के जवाब दो", "10 ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸು"),
               "combo_3": ("Get a 3 combo", "लगातार 3 सही करो", "ಸತತ 3 ಸರಿ ಮಾಡು"),
               "lesson_1": ("Finish a lesson", "एक पाठ पूरा करो", "ಒಂದು ಪಾಠ ಮುಗಿಸು"),
               "lessons_5": ("Finish 5 lessons", "5 पाठ पूरे करो", "5 ಪಾಠಗಳನ್ನು ಮುಗಿಸು"),
               "revision_5": ("Revise 5 fading ideas (double gems)", "5 भूलते विषय दोहराओ (दुगने रत्न)",
                              "ಮರೆಯುತ್ತಿರುವ 5 ವಿಷಯಗಳನ್ನು ಪುನರಾವರ್ತಿಸು (ಎರಡು ಪಟ್ಟು ರತ್ನ)")}


def _quest(q: dict[str, Any], now: datetime) -> dict[str, Any]:
    weekly = q["kind"] == "weekly"
    ends = _week_end(now) if weekly else datetime.combine(r.ist_date(now) + timedelta(days=1), datetime.min.time(),
                                                           tzinfo=r.IST).astimezone(UTC).isoformat()
    return {"id": q["code"], "period": "weekly" if weekly else "daily", "kind": QUEST_KIND.get(q["code"], "answer_questions"),
            "title": dict(zip(("en", "hi", "kn"), QUEST_TITLE.get(q["code"], (q["code"],) * 3), strict=True)),
            "progress": min(q["progress"], q["target"]), "goal": q["target"], "reward_gems": q["gems"],
            # rewards are paid the moment a quest completes, so a complete quest is already claimed
            "state": "claimed" if q["completed"] else "active", "ends_at": ends}


@router.get("/game/quests")
def g_quests(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    now = engine.utcnow()
    return [_quest(q, now) for q in list_quests(db, _lid(db, user), now)]


@router.post("/game/quests/{quest_id}/claim")
def g_claim(quest_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    now = engine.utcnow()
    q = next((x for x in list_quests(db, lid, now) if x["code"] == quest_id), None)
    if q is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    if not q["completed"]:
        raise HTTPException(409, {"code": "NOT_COMPLETE"})
    return {"quest": _quest(q, now), "stats": game_stats(db, lid)}


@router.get("/game/league")
def g_league(db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    now = engine.utcnow()
    st = engine.load_stats(db, lid, now, lock=False)
    s = leagues.standings(db, lid, st["league_tier"], now)
    return {"enabled": s["enabled"], "tier": s["tier"], "week_ends_at": _week_end(now),
            "promote_count": s.get("promote_zone", 3), "demote_count": s.get("demote_zone", 3),
            "members": [{"rank": m["rank"], "name": m["name"], "weekly_xp": m["xp"], "is_self": m["me"],
                         "call_only": m["is_call"]} for m in s["pod"]]}


@router.get("/game/badges")
def g_badges(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    lid = _lid(db, user)
    rows = db.execute(text("select b.code, b.title, a.awarded_at from badges b left join badge_awards a "
                           "on a.badge_code=b.code and a.learner_id=:l order by a.awarded_at nulls last, b.code"),
                      {"l": lid}).mappings().all()
    return [{"id": x["code"], "name": tri(x["title"]), "rule": tri(x["title"]), "icon": x["code"].split("_")[0],
             "earned_at": iso(x["awarded_at"]), "progress": None, "goal": None} for x in rows]


@router.post("/game/pots/{pot_id}/open")
def g_open_pot(pot_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    reward = open_pot(db, lid, pot_id, engine.utcnow())
    return {"pot_id": pot_id, "reward": {"kind": reward["type"], "amount": reward.get("amount"),
                                         "item": reward.get("item")}, "stats": game_stats(db, lid)}


# =====================================================================================
# CALL CONSOLE (teacher)
# =====================================================================================
LANG_TO = {"hindi": "hi", "kannada": "kn"}
LANG_FROM = {"hi": "hindi", "kn": "kannada"}


def _own_class(db: Connection, user: UserOut, classroom_id: str) -> Any:
    _teacher(user)
    c = db.execute(text("select id, name, class_key, school_consent, league_enabled, subject, grade, created_at "
                        "from classrooms where id=:c and teacher_id=:t"),
                   {"c": classroom_id, "t": user.id}).mappings().first()
    if c is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return c


def _own_call_student(db: Connection, user: UserOut, cs_id: str) -> Any:
    _teacher(user)
    cs = db.execute(text("select cs.*, l.id as learner_id from call_students cs join classrooms c on c.id=cs.classroom_id "
                         "join learners l on l.call_student_id=cs.id where cs.id=:i and c.teacher_id=:t"),
                    {"i": cs_id, "t": user.id}).mappings().first()
    if cs is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return cs


def call_student_out(db: Connection, cs: Any) -> dict[str, Any]:
    now = engine.utcnow()
    week = datetime.combine(r.week_start(r.ist_date(now)), datetime.min.time(), tzinfo=r.IST)
    secs = db.execute(text("select coalesce(sum(seconds_used),0) from call_sessions where call_student_id=:c "
                           "and created_at >= :w"), {"c": cs["id"], "w": week}).scalar_one()
    last = db.execute(text("select status, coalesce(ended_at, created_at) as at, seconds_used from call_sessions "
                           "where call_student_id=:c and status in ('completed','missed','answered') "
                           "order by created_at desc limit 1"), {"c": cs["id"]}).mappings().first()
    live = db.execute(text("select 1 from call_sessions where call_student_id=:c and status in ('ringing','answered') "
                           "and created_at > now() - interval '30 minutes' limit 1"), {"c": cs["id"]}).scalar()
    nxt = db.execute(text("select min(scheduled_for) from call_sessions where call_student_id=:c and status='scheduled'"),
                     {"c": cs["id"]}).scalar()
    retry = db.execute(text("select 1 from call_sessions where call_student_id=:c and status='missed' "
                            "and created_at > now() - interval '1 day' limit 1"), {"c": cs["id"]}).scalar()
    if cs["status"] == "waiting_consent":
        status = "waiting_consent"
    elif cs["status"] in ("paused", "declined"):
        status = "paused"
    elif cs["status"] == "not_reachable":
        status = "not_reachable"
    elif live:
        status = "in_call"
    elif secs >= flow.WEEKLY_CAP_SECONDS:
        status = "cap_reached"
    elif retry and nxt:
        status = "retry_pending"
    else:
        status = "scheduled"
    phone = cs["parent_phone_e164"] or cs["phone_e164"]
    return {"id": str(cs["id"]), "classroom_id": str(cs["classroom_id"]), "name": cs["name"],
            "phone_last4": phone[-4:], "language": LANG_FROM.get(cs["language"], "hindi"),
            "window": {"start": cs["window_start"].strftime("%H:%M"), "end": cs["window_end"].strftime("%H:%M")},
            "days": list(cs["call_days"] or []), "status": status, "minutes_this_week": round(secs / 60),
            "weekly_cap_minutes": flow.WEEKLY_CAP_SECONDS // 60, "next_call_at": iso(nxt),
            "last_call": {"at": iso(last["at"]), "outcome": "completed" if last["status"] != "missed" else "no_answer",
                          "minutes": round(last["seconds_used"] / 60)} if last else None,
            "created_at": iso(cs["created_at"])}


@router.get("/classrooms/{classroom_id}/call-students")
def c_list(classroom_id: str, db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _own_class(db, user, classroom_id)
    rows = db.execute(text("select * from call_students where classroom_id=:c order by name"),
                      {"c": classroom_id}).mappings().all()
    return [call_student_out(db, x) for x in rows]


class WindowIn(BaseModel):
    start: str
    end: str


class CallStudentIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    parent_phone: str
    language: str
    window: WindowIn
    days: list[int]


@router.post("/classrooms/{classroom_id}/call-students", status_code=201)
def c_create(classroom_id: str, body: CallStudentIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    from app.auth.service import normalize_phone
    _own_class(db, user, classroom_id)
    if body.language not in LANG_TO or not body.days or any(d < 1 or d > 7 for d in body.days):
        raise HTTPException(422, {"code": "VALIDATION"})
    if not ("09:00" <= body.window.start < body.window.end <= "21:00"):
        raise HTTPException(422, {"code": "WINDOW_OUTSIDE_9_TO_9"})
    phone = normalize_phone(body.parent_phone)
    csid = db.execute(text(
        "insert into call_students(classroom_id, name, phone_e164, language, call_days, window_start, window_end, "
        "parent_phone_e164) values (:c,:n,:p,:l,:d,cast(:ws as time),cast(:we as time),:p) returning id"),
        {"c": classroom_id, "n": body.name, "p": phone, "l": LANG_TO[body.language], "d": body.days,
         "ws": body.window.start, "we": body.window.end}).scalar_one()
    create_learner(db, call_student_id=csid)
    row = db.execute(text("select * from call_students where id=:i"), {"i": csid}).mappings().one()
    return call_student_out(db, row)


class CallPatchIn(BaseModel):
    paused: bool | None = None
    language: str | None = None
    window: WindowIn | None = None
    days: list[int] | None = None


@router.patch("/call-students/{cs_id}")
def c_patch(cs_id: str, body: CallPatchIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    cs = _own_call_student(db, user, cs_id)
    status = cs["status"]
    if body.paused is True and status in ("active", "not_reachable"):
        status = "paused"
    elif body.paused is False and status == "paused":
        status = "active"
    ws = body.window.start if body.window else cs["window_start"].strftime("%H:%M")
    we = body.window.end if body.window else cs["window_end"].strftime("%H:%M")
    if not ("09:00" <= ws < we <= "21:00"):
        raise HTTPException(422, {"code": "WINDOW_OUTSIDE_9_TO_9"})
    db.execute(text("update call_students set status=:s, language=coalesce(:l, language), call_days=coalesce(:d, call_days), "
                    "window_start=cast(:ws as time), window_end=cast(:we as time) where id=:i"),
               {"s": status, "l": LANG_TO.get(body.language or "", None), "d": body.days, "ws": ws, "we": we, "i": cs_id})
    return call_student_out(db, db.execute(text("select * from call_students where id=:i"), {"i": cs_id}).mappings().one())


def _session_out(s: Any) -> dict[str, Any]:
    state = {"scheduled": "dialing", "ringing": "ringing", "answered": "connected", "completed": "completed",
             "missed": "no_answer", "failed": "failed"}.get(s["status"], "dialing")
    return {"id": str(s["id"]), "call_student_id": str(s["call_student_id"]), "state": state, "attempt": s["attempt"],
            "started_at": iso(s["created_at"]), "connected_at": None, "ended_at": iso(s["ended_at"]),
            "minutes": round((s["seconds_used"] or 0) / 60), "retry_at": None}


@router.post("/call-students/{cs_id}/call-now")
def c_call_now(cs_id: str, db: DbDep, user: UserDep,
               provider: Annotated[TelephonyProvider, Depends(telephony)]) -> dict[str, Any]:
    _own_call_student(db, user, cs_id)
    out = flow.start_call(db, cs_id, user.id, provider, engine.utcnow())
    s = db.execute(text("select * from call_sessions where id=:i"), {"i": out["session_id"]}).mappings().one()
    return _session_out(s)


@router.get("/call-students/{cs_id}/call")
def c_call(cs_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _own_call_student(db, user, cs_id)
    s = db.execute(text("select * from call_sessions where call_student_id=:c order by created_at desc limit 1"),
                   {"c": cs_id}).mappings().first()
    if s is None:
        raise HTTPException(404, {"code": "NO_CALL"})
    return _session_out(s)


@router.get("/call-students/{cs_id}/twin")
def c_twin(cs_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    cs = _own_call_student(db, user, cs_id)
    now = engine.utcnow()
    rows = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review from twin_concepts "
                           "where learner_id=:l"), {"l": cs["learner_id"]}).mappings().all()
    scored = sorted(((x["concept"], twin.effective_mastery(twin.TwinState(x["mastery"], x["half_life_days"],
                     x["last_seen"], x["next_review"]), now)) for x in rows), key=lambda t: t[1])
    heard = db.execute(text("select count(distinct lesson_id) from answer_attempts where learner_id=:l and channel='call'"),
                       {"l": cs["learner_id"]}).scalar_one()
    plan = flow.plan_call(db, {"learner_id": cs["learner_id"], "classroom_id": cs["classroom_id"], "id": None})
    weak = [tri(c) for c, m in scored if m < 0.6][:5]
    strong = [tri(c) for c, m in reversed(scored) if m >= 0.7][:5]
    summary = (f"Heard {heard} lessons by phone. Next: {plan.get('lesson_title') or 'no lesson yet'}.")
    return {"call_student_id": cs_id, "lessons_heard": heard,
            "last_topic": tri(plan["lesson_title"]) if plan.get("lesson_title") else None,
            "strong": strong, "weak": weak, "summary": tri(summary)}


# =====================================================================================
# TEACHER
# =====================================================================================
def _students(db: Connection, classroom_id: Any) -> list[Any]:
    return list(db.execute(text("select u.id, u.name, u.created_at, l.id as lid from memberships m join users u on u.id=m.user_id "
                                "join learners l on l.user_id=u.id where m.classroom_id=:c order by u.name"),
                           {"c": classroom_id}).mappings().all())


def classroom_out(db: Connection, c: Any, members: bool = False) -> dict[str, Any]:
    studs = _students(db, c["id"])
    out = {"id": str(c["id"]), "name": c["name"], "subject": c["subject"], "grade": c["grade"],
           "join_key": f"{c['class_key'][:4]}-{c['class_key'][4:]}", "expires_at": None,
           "allowed_language_modes": ["hindi", "kannada"], "student_count": len(studs), "created_at": iso(c["created_at"])}
    if members:
        out["members"] = [{"id": str(s["id"]), "name": s["name"], "joined_at": iso(s["created_at"])} for s in studs]
    return out


@router.get("/classrooms")
def t_classes(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _teacher(user)
    rows = db.execute(text("select * from classrooms where teacher_id=:t order by created_at"), {"t": user.id}).mappings().all()
    return [classroom_out(db, x) for x in rows]


class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    subject: str = "BI"
    grade: int = 7
    allowed_language_modes: list[str] | None = None


@router.post("/classrooms", status_code=201)
def t_create_class(body: ClassIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    _teacher(user)
    subject = body.subject if body.subject in CODE_SUBJECT else "BI"
    for _ in range(5):
        key = class_key(subject, body.grade)
        if db.execute(text("select 1 from classrooms where class_key=:k"), {"k": key}).scalar() is None:
            break
    cid = db.execute(text("insert into classrooms(teacher_id, name, class_key, subject, grade) values (:t,:n,:k,:s,:g) "
                          "returning id"), {"t": user.id, "n": body.name, "k": key, "s": subject, "g": body.grade}).scalar_one()
    return classroom_out(db, db.execute(text("select * from classrooms where id=:c"), {"c": cid}).mappings().one())


@router.get("/classrooms/{classroom_id}")
def t_class(classroom_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    return classroom_out(db, _own_class(db, user, classroom_id), members=True)


def _accuracy(db: Connection, lid: Any, since: datetime | None = None) -> float | None:
    row = db.execute(text("select count(*) as n, count(*) filter (where correct) as ok from answer_attempts "
                          "where learner_id=:l and (cast(:s as timestamptz) is null or created_at >= :s)"),
                     {"l": lid, "s": since}).mappings().one()
    return round(row["ok"] / row["n"], 2) if row["n"] else None


def _student_row(db: Connection, s: Any, now: datetime) -> dict[str, Any]:
    st = engine.load_stats(db, s["lid"], now, lock=False)
    idle = (now - st["last_activity_at"]).days if st["last_activity_at"] else 99
    cur = db.execute(text("select l.title from lesson_progress p join lessons l on l.id=p.lesson_id "
                          "where p.learner_id=:l and p.completed_at is null order by p.started_at desc limit 1"),
                     {"l": s["lid"]}).scalar()
    return {"id": str(s["id"]), "name": s["name"], "streak": engine.display_streak(st, now),
            "current_lesson": tri(cur) if cur else None, "accuracy": _accuracy(db, s["lid"]),
            "idle_days": min(idle, 99), "idle": idle >= 3, "behind": idle >= 7, "overdue": 0}


@router.get("/classrooms/{classroom_id}/dashboard")
def t_dashboard(classroom_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    c = _own_class(db, user, classroom_id)
    now = engine.utcnow()
    studs = _students(db, c["id"])
    rows = [_student_row(db, s, now) for s in studs]
    courses = db.execute(text("select c.id, c.title from courses c join course_assignments a on a.course_id=c.id "
                              "where a.classroom_id=:k"), {"k": c["id"]}).mappings().all()
    weak = twin_read.class_weak_topics(db, [s["lid"] for s in studs], now)        # with forgetting applied
    accs = [x["accuracy"] for x in rows if x["accuracy"] is not None]
    return {"classroom_id": str(c["id"]), "name": c["name"], "join_key": f"{c['class_key'][:4]}-{c['class_key'][4:]}",
            "school_consent": c["school_consent"], "courses": [{"id": str(x["id"]), "title": tri(x["title"])} for x in courses],
            "tiles": {"active_this_week": sum(1 for x in rows if x["idle_days"] < 7), "student_count": len(rows),
                      "accuracy": round(sum(accs) / len(accs), 2) if accs else None,
                      "behind": sum(1 for x in rows if x["behind"])},
            "weak_topics": [{"kind": "concept", "key": w["concept"], "name": tri(w["concept"]), "accuracy": round(w["mastery"], 2),
                             "attempts": w["learners"], "low_mastery_students": w["low"]} for w in weak],
            "students": rows}


@router.get("/classrooms/{classroom_id}/students/{student_id}")
def t_student(classroom_id: str, student_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    c = _own_class(db, user, classroom_id)
    s = next((x for x in _students(db, c["id"]) if str(x["id"]) == student_id), None)
    if s is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    now = engine.utcnow()
    st = engine.load_stats(db, s["lid"], now, lock=False)
    lessons = db.execute(text("select p.lesson_id, l.title, p.completed_at is not null as done, p.accuracy from lesson_progress p "
                              "join lessons l on l.id=p.lesson_id where p.learner_id=:l order by p.started_at"),
                         {"l": s["lid"]}).mappings().all()
    concepts = twin_read.weakest(db, s["lid"], now, 5)
    conf = db.execute(text("select concept, confused_with, count from twin_confusions where learner_id=:l order by count desc limit 5"),
                      {"l": s["lid"]}).mappings().all()
    hours = db.execute(text("select extract(hour from created_at at time zone 'Asia/Kolkata')::int as h from answer_attempts "
                            "where learner_id=:l group by 1 order by count(*) desc limit 1"), {"l": s["lid"]}).scalar()
    a_now, a_before = _accuracy(db, s["lid"], now - timedelta(days=7)), _accuracy(db, s["lid"])
    trend = "steady" if a_now is None or a_before is None else ("improving" if a_now > a_before + 0.05 else
                                                                "declining" if a_now < a_before - 0.05 else "steady")
    return {"id": student_id, "name": s["name"], "streak": engine.display_streak(st, now),
            "last_active": iso(st["last_activity_at"]), "lessons_completed": st["lessons_completed"],
            "lessons": [{"lesson_id": str(x["lesson_id"]), "title": tri(x["title"]), "completed": x["done"],
                         "accuracy": float(x["accuracy"]) if x["accuracy"] is not None else None} for x in lessons],
            "weakest": [{"kind": "concept", "name": tri(x["concept"]), "mastery": round(x["mastery"], 2)} for x in concepts],
            "confusions": [{"expected": tri(x["concept"]), "chosen": tri(x["confused_with"]), "count": x["count"]} for x in conf],
            "trend": trend, "usual_hour": hours}


class ConsentIn(BaseModel):
    enabled: bool


@router.put("/classrooms/{classroom_id}/school-consent")
def t_school_consent(classroom_id: str, body: ConsentIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    _own_class(db, user, classroom_id)
    db.execute(text("update classrooms set school_consent=:v where id=:c"), {"v": body.enabled, "c": classroom_id})
    db.execute(text("insert into audit_log(actor, action, detail) values (:a,:k,cast(:d as jsonb))"),
               {"a": user.id, "k": "school_consent_" + ("on" if body.enabled else "off"),
                "d": json.dumps({"classroom_id": classroom_id})})
    return {"classroom_id": classroom_id, "school_consent": body.enabled}


# ---------- uploads: create -> PUT each page -> start -> poll ----------
class PageIn(BaseModel):
    kind: str
    text: str | None = None
    size_bytes: int | None = None


class UploadIn(BaseModel):
    pages: list[PageIn] = Field(min_length=1, max_length=20)
    subject: str | None = None
    grade: int | None = None
    classroom_id: str | None = None
    personal: bool = False


@router.post("/uploads", status_code=201)
def t_upload_create(body: UploadIn, request: Request, db: DbDep, user: UserDep) -> dict[str, Any]:
    _teacher(user)
    uid = db.execute(text("insert into uploads(teacher_id, language, class_level, classroom_id) values (:t,'hi',:g,:c) "
                          "returning id"), {"t": user.id, "g": body.grade, "c": body.classroom_id}).scalar_one()
    base = str(request.base_url).rstrip("/")
    targets: list[dict[str, Any]] = []
    for i, p in enumerate(body.pages):
        if p.kind == "text":
            path = storage.save((p.text or "").encode("utf-8"), ".txt")
            db.execute(text("insert into upload_pages(upload_id, page_no, storage_path, mime) values (:u,:n,:p,'text/plain')"),
                       {"u": uid, "n": i + 1, "p": path})
            targets.append({"index": i, "upload_url": None, "method": "PUT", "headers": {}})
        else:                          # signed link, like a storage URL: no bearer token needed
            exp = int(engine.utcnow().timestamp()) + UPLOAD_LINK_SECONDS
            sig = _page_sig(str(uid), i, exp)
            targets.append({"index": i, "upload_url": f"{base}/web/uploads/{uid}/pages/{i}?exp={exp}&sig={sig}",
                            "method": "PUT", "headers": {}})
    return {"id": str(uid), "pages": targets}


UPLOAD_LINK_SECONDS = 3600


def _page_sig(upload_id: str, index: int, exp: int) -> str:
    import hashlib
    import hmac

    from app.config import get_settings
    key = get_settings().supabase_jwt_secret.encode()
    return hmac.new(key, f"upload:{upload_id}:{index}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]


@router.put("/uploads/{upload_id}/pages/{index}", status_code=204)
async def t_upload_page(upload_id: str, index: int, request: Request, db: DbDep, exp: int = 0,
                        sig: str = "") -> None:
    """Receives one page at the signed link handed out by POST /uploads (no bearer token)."""
    import hmac
    if exp < engine.utcnow().timestamp() or not hmac.compare_digest(sig, _page_sig(upload_id, index, exp)):
        raise HTTPException(403, {"code": "LINK_EXPIRED_OR_INVALID"})
    if db.execute(text("select 1 from uploads where id=:u and started_at is null"),
                  {"u": upload_id}).scalar() is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    if db.execute(text("select 1 from upload_pages where upload_id=:u and page_no=:n"),
                  {"u": upload_id, "n": index + 1}).scalar() is not None:
        db.execute(text("delete from upload_pages where upload_id=:u and page_no=:n"),   # "try this page again"
                   {"u": upload_id, "n": index + 1})
    mime = (request.headers.get("content-type") or "").split(";")[0].lower()
    if mime not in ai_routes.ALLOWED:
        raise HTTPException(415, {"code": "UNSUPPORTED_FILE"})
    data = await request.body()
    if len(data) > ai_routes.MAX_FILE_BYTES:
        raise HTTPException(413, {"code": "TOO_LARGE"})
    path = storage.save(data, ai_routes.ALLOWED[mime])
    db.execute(text("insert into upload_pages(upload_id, page_no, storage_path, mime) values (:u,:n,:p,:m)"),
               {"u": upload_id, "n": index + 1, "p": path, "m": mime})


STEPS = ["queued", "reading", "chunking", "outlining", "terms", "lesson_1", "ready"]


def upload_status(db: Connection, upload_id: str, teacher_id: str) -> dict[str, Any]:
    u = db.execute(text("select id, status, error, course_id, started_at, (select count(*) from upload_pages p "
                        "where p.upload_id=u.id) as pages from uploads u where id=:u and teacher_id=:t"),
                   {"u": upload_id, "t": teacher_id}).mappings().first()
    if u is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    first = None
    if u["course_id"]:
        first = db.execute(text("select l.id from lessons l join units un on un.id=l.unit_id where un.course_id=:c "
                                "order by un.position, l.position limit 1"), {"c": u["course_id"]}).scalar()
    if u["started_at"] is None:
        status, steps = "created", []
    elif u["status"] == "failed":
        status, steps = "failed", ["queued"]
    elif u["status"] == "done":
        status, steps = "ready", STEPS
    elif u["status"] == "outline":
        status, steps = "outlining", STEPS[:4]
    elif u["status"] == "ocr":
        status, steps = "reading", STEPS[:2]
    else:
        status, steps = "queued", STEPS[:1]
    return {"id": str(u["id"]), "status": status, "steps": steps, "page_count": u["pages"], "error": u["error"],
            "course_id": str(u["course_id"]) if u["course_id"] else None, "first_lesson_id": str(first) if first else None}


@router.post("/uploads/{upload_id}/start")
def t_upload_start(upload_id: str, background: BackgroundTasks, db: DbDep, user: UserDep,
                   runner: Annotated[Any, Depends(ai_routes.pipeline_runner)]) -> dict[str, Any]:
    _teacher(user)
    n = db.execute(text("update uploads set started_at=now() where id=:u and teacher_id=:t and started_at is null "
                        "and exists (select 1 from upload_pages p where p.upload_id=uploads.id)"),
                   {"u": upload_id, "t": user.id}).rowcount
    if not n:
        raise HTTPException(409, {"code": "NO_PAGES_OR_ALREADY_STARTED"})
    db.commit()
    background.add_task(runner, upload_id)
    return upload_status(db, upload_id, user.id)


@router.get("/uploads/{upload_id}")
def t_upload_get(upload_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _teacher(user)
    return upload_status(db, upload_id, user.id)


# ---------- courses, lessons, questions (teacher review) ----------
def _own_course(db: Connection, user: UserOut, course_id: str) -> Any:
    _teacher(user)
    c = db.execute(text("select * from courses where id=:c and teacher_id=:t"), {"c": course_id, "t": user.id}).mappings().first()
    if c is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return c


def _lesson_summaries(db: Connection, course: Any) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select u.id as uid, u.title as ut, l.id, l.title, l.position, "
        "(select count(*) from questions q where q.lesson_id=l.id) as n, "
        "(select count(*) from questions q where q.lesson_id=l.id and q.flagged) as f "
        "from units u join lessons l on l.unit_id=u.id where u.course_id=:c order by u.position, l.position"),
        {"c": course["id"]}).mappings().all()
    units: dict[str, Any] = {}
    for i, x in enumerate(rows, start=1):
        units.setdefault(str(x["uid"]), {"id": str(x["uid"]), "title": tri(x["ut"]), "lessons": []})["lessons"].append(
            {"id": str(x["id"]), "position": i, "title": tri(x["title"]), "generation_status": "ready",
             "published": course["status"] == "published", "question_count": x["n"], "flagged_count": x["f"]})
    return list(units.values())


def course_summary(db: Connection, c: Any) -> dict[str, Any]:
    units = _lesson_summaries(db, c)
    n = sum(len(u["lessons"]) for u in units)
    return {"id": str(c["id"]), "title": tri(c["title"]), "subject": SUBJECT_CODE.get(c["subject"], "BI"), "grade": 7,
            "status": c["status"], "is_personal": False, "ai_made": True, "lesson_count": n,
            "published_count": n if c["status"] == "published" else 0}


def course_out(db: Connection, c: Any) -> dict[str, Any]:
    units = _lesson_summaries(db, c)
    assigned = db.execute(text("select classroom_id from course_assignments where course_id=:c"), {"c": c["id"]}).scalars().all()
    qn = sum(le["question_count"] for u in units for le in u["lessons"])
    return {**course_summary(db, c), "units": units, "assigned_classroom_ids": [str(a) for a in assigned],
            "question_count": qn, "edited_count": 0}


@router.get("/courses")
def t_courses(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _teacher(user)
    return [course_summary(db, c) for c in db.execute(text("select * from courses where teacher_id=:t order by created_at desc"),
                                                     {"t": user.id}).mappings().all()]


@router.get("/courses/{course_id}")
def t_course(course_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    return course_out(db, _own_course(db, user, course_id))


class TitleIn(BaseModel):
    title: dict[str, str]


@router.put("/courses/{course_id}")
def t_rename(course_id: str, body: TitleIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    _own_course(db, user, course_id)
    title = body.title.get("hi") or body.title.get("en") or body.title.get("kn") or "Course"
    db.execute(text("update courses set title=:n where id=:c"), {"n": title[:120], "c": course_id})
    return course_out(db, _own_course(db, user, course_id))


def teacher_question_out(q: Any) -> dict[str, Any] | None:
    """Like question_out, plus the answer (teachers review it)."""
    out = question_out(q, q.get("page_no"))
    if out is None:
        return None
    if q["kind"] == "mcq":
        opts = [json.dumps(o, sort_keys=True) for o in (q["options"] or [])]
        key = json.dumps(q["answer"], sort_keys=True)
        out["content"]["correct_index"] = opts.index(key) if key in opts else 0
    elif q["kind"] == "true_false":
        out["content"]["answer"] = q["answer"] in (True, "true", "True")
    out["flag_reason"] = "low_confidence" if q.get("flagged") else None
    out["confidence"] = 0.5 if q.get("flagged") else 0.9
    return out


def _question(db: Connection, user: UserOut, question_id: str) -> Any:
    _teacher(user)
    q = db.execute(text(
        "select q.id, q.kind, q.prompt, q.options, q.answer, q.position, q.call_safe, q.flagged, p.page_no "
        "from questions q join lessons l on l.id=q.lesson_id join units u on u.id=l.unit_id join courses c on c.id=u.course_id "
        "left join upload_pages p on p.id=q.source_page_id where q.id=:q and c.teacher_id=:t"),
        {"q": question_id, "t": user.id}).mappings().first()
    if q is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return dict(q)


def t_lesson_review(lesson_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    """The teacher's view of a lesson, with answers. Served by GET /lessons/{id} for teachers."""
    _teacher(user)
    row = db.execute(text("select l.id, l.title, l.kind, l.content, u.course_id, c.status from lessons l join units u "
                          "on u.id=l.unit_id join courses c on c.id=u.course_id where l.id=:l and c.teacher_id=:t"),
                     {"l": lesson_id, "t": user.id}).mappings().first()
    if row is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    qs = db.execute(text("select q.id, q.kind, q.prompt, q.options, q.answer, q.position, q.call_safe, q.flagged, p.page_no "
                         "from questions q left join upload_pages p on p.id=q.source_page_id where q.lesson_id=:l "
                         "order by q.flagged desc, q.position"), {"l": lesson_id}).mappings().all()
    terms = db.execute(text("select english, regional, definition from terms where course_id=:c"),
                       {"c": row["course_id"]}).mappings().all()
    return {"id": str(row["id"]), "course_id": str(row["course_id"]), "title": tri(row["title"]), "generation_status": "ready",
            "published": row["status"] == "published",
            "questions": [x for q in qs if (x := teacher_question_out(dict(q))) is not None],
            "terms": {term_key(t["english"]): term_content(t) for t in terms},
            "kind": row["kind"], "media": _media(row["kind"], row["content"])}


class QuestionIn(BaseModel):
    question: dict[str, Any]


@router.put("/questions/{question_id}")
def t_edit_question(question_id: str, body: QuestionIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    q = _question(db, user, question_id)
    c = body.question
    prompt = c.get("statement") if q["kind"] == "true_false" and c.get("statement") else c.get("prompt")
    sets: dict[str, Any] = {}
    if isinstance(prompt, dict):
        sets["prompt"] = {**prompt, "regional": prompt.get("hi", ""), "english": prompt.get("en", "")}
    if q["kind"] == "mcq" and isinstance(c.get("options"), list):
        opts = [o.get("text") or o.get("term_key") for o in c["options"]]
        sets["options"] = opts
        idx = int(c.get("correct_index", 0))
        sets["answer"] = opts[idx] if 0 <= idx < len(opts) else opts[0]
    elif q["kind"] == "true_false" and "answer" in c:
        sets["answer"] = bool(c["answer"])
    for col, val in sets.items():
        db.execute(text(f"update questions set {col}=cast(:v as jsonb), flagged=false where id=:q"),
                   {"v": json.dumps(val, ensure_ascii=False), "q": question_id})
    if not sets:
        db.execute(text("update questions set flagged=false where id=:q"), {"q": question_id})
    out = teacher_question_out(_question(db, user, question_id))
    if out is None:
        raise HTTPException(422, {"code": "UNSUPPORTED_TYPE"})
    out["teacher_edited"] = True
    return out


@router.delete("/questions/{question_id}", status_code=204)
def t_delete_question(question_id: str, db: DbDep, user: UserDep) -> None:
    _question(db, user, question_id)
    db.execute(text("delete from questions where id=:q"), {"q": question_id})


@router.post("/questions/{question_id}/regenerate")
def t_regenerate(question_id: str, db: DbDep, user: UserDep,
                 model: Annotated[Any, Depends(ai_routes.llm)]) -> dict[str, Any]:
    q = _question(db, user, question_id)
    lesson = db.execute(text("select lesson_id from questions where id=:q"), {"q": question_id}).scalar_one()
    ai_routes.regenerate_question(question_id, db, user, model)
    new = db.execute(text("select id from questions where lesson_id=:l and position=:p order by id desc limit 1"),
                     {"l": lesson, "p": q["position"]}).scalar()
    out = teacher_question_out(_question(db, user, str(new))) if new else None
    if out is None:
        raise HTTPException(502, {"code": "REGENERATE_FAILED"})
    return out


class PublishIn(BaseModel):
    classroom_id: str | None = None


@router.post("/lessons/{lesson_id}/publish")
def t_publish(lesson_id: str, body: PublishIn, background: BackgroundTasks, db: DbDep, user: UserDep) -> dict[str, Any]:
    """Publishing is per course in this backend: the lesson's whole course goes live."""
    from app.routers.teacher import publish as publish_course
    course = db.execute(text("select u.course_id from lessons l join units u on u.id=l.unit_id where l.id=:l"),
                        {"l": lesson_id}).scalar()
    if course is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    c = _own_course(db, user, str(course))
    publish_course(str(c["id"]), db, user, background)
    # the class picked when the notes were uploaded, plus the one picked now
    targets = {str(k) for k in db.execute(text("select classroom_id from uploads where course_id=:c and classroom_id is not null"),
                                          {"c": c["id"]}).scalars()}
    if body.classroom_id:
        _own_class(db, user, body.classroom_id)
        targets.add(body.classroom_id)
    for k in targets:
        db.execute(text("insert into course_assignments values (:c,:k) on conflict do nothing"), {"c": c["id"], "k": k})
    for k in db.execute(text("select classroom_id from course_assignments where course_id=:c"), {"c": c["id"]}).scalars():
        share_course_notes(db, c["id"], k)
    units = _lesson_summaries(db, _own_course(db, user, str(course)))
    return next(le for u in units for le in u["lessons"] if le["id"] == lesson_id)


class AssignIn(BaseModel):
    classroom_ids: list[str]
    due_at: str | None = None


@router.post("/courses/{course_id}/assign")
def t_assign(course_id: str, body: AssignIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    c = _own_course(db, user, course_id)
    for k in body.classroom_ids:
        _own_class(db, user, k)
        db.execute(text("insert into course_assignments values (:c,:k) on conflict do nothing"), {"c": course_id, "k": k})
        if c["status"] == "published":
            share_course_notes(db, course_id, k)
    return course_out(db, _own_course(db, user, course_id))


class UnassignIn(BaseModel):
    classroom_ids: list[str]


@router.post("/courses/{course_id}/unassign")
def t_unassign(course_id: str, body: UnassignIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    """Takes a course out of classes (students' progress is kept, so adding it back resumes where they were)."""
    _own_course(db, user, course_id)
    for k in body.classroom_ids:
        _own_class(db, user, k)
        db.execute(text("delete from course_assignments where course_id=:c and classroom_id=:k"), {"c": course_id, "k": k})
    return course_out(db, _own_course(db, user, course_id))


# ---------- teacher overview, insights, materials, notes ----------
def _ref(row: dict[str, Any]) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "accuracy": row["accuracy"], "streak": row["streak"],
            "idle_days": row["idle_days"], "behind": row["behind"], "idle": row["idle"]}


@router.get("/teacher/overview")
def t_overview(db: DbDep, user: UserDep) -> dict[str, Any]:
    _teacher(user)
    now = engine.utcnow()
    classes, all_rows = [], []
    for c in db.execute(text("select * from classrooms where teacher_id=:t order by created_at"), {"t": user.id}).mappings().all():
        rows = [_student_row(db, s, now) for s in _students(db, c["id"])]
        all_rows += rows
        accs = [x["accuracy"] for x in rows if x["accuracy"] is not None]
        classes.append({"id": str(c["id"]), "name": c["name"], "subject": c["subject"], "grade": c["grade"],
                        "join_key": f"{c['class_key'][:4]}-{c['class_key'][4:]}", "student_count": len(rows),
                        "accuracy": round(sum(accs) / len(accs), 2) if accs else None, "completion": 0})
    accs = [x["accuracy"] for x in all_rows if x["accuracy"] is not None]
    by_subject: dict[str, list[Any]] = {}
    for cl in classes:
        by_subject.setdefault(cl["subject"], []).append(cl)
    return {"class_count": len(classes), "student_count": len(all_rows),
            "accuracy": round(sum(accs) / len(accs), 2) if accs else None, "completion": 0, "classes": classes,
            "subjects": [{"subject": s, "accuracy": None, "classes": len(cs)} for s, cs in by_subject.items()],
            "doing_well": [_ref(x) for x in sorted(all_rows, key=lambda x: -(x["accuracy"] or 0))[:5] if x["accuracy"]],
            "needs_attention": [_ref(x) for x in all_rows if x["idle"] or x["behind"]][:5], "recent": []}


@router.get("/classrooms/{classroom_id}/insights")
def t_insights(classroom_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    d = t_dashboard(classroom_id, db, user)
    rows = d["students"]
    return {"classroom_id": classroom_id, "student_count": len(rows), "accuracy": d["tiles"]["accuracy"], "completion": 0,
            "trend": [], "topics": [{"name": w["name"], "accuracy": w["accuracy"]} for w in d["weak_topics"]],
            "doing_well": [_ref(x) for x in rows if (x["accuracy"] or 0) >= 0.7][:5],
            "needs_attention": [_ref(x) for x in rows if x["idle"] or x["behind"]][:5], "missed": []}


@router.get("/teacher/materials")
def t_materials(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _teacher(user)
    rows = db.execute(text(
        "select u.id, u.course_id, u.status, u.started_at, u.created_at, c.status as course_status, k.name as classroom, "
        "(select json_agg(json_build_object('mime', p.mime)) from upload_pages p where p.upload_id=u.id) as files "
        "from uploads u left join courses c on c.id=u.course_id left join classrooms k on k.id=u.classroom_id "
        "where u.teacher_id=:t order by u.created_at desc"), {"t": user.id}).mappings().all()
    out = []
    for x in rows:
        status = ("published" if x["course_status"] == "published" else "review") if x["course_id"] else \
                 ("processing" if x["started_at"] else "draft")
        files = [{"name": f"page-{i + 1}", "kind": "pdf" if (f or {}).get("mime") == "application/pdf" else
                  "text" if (f or {}).get("mime") == "text/plain" else "photo"} for i, f in enumerate(x["files"] or [])]
        out.append({"id": str(x["id"]), "files": files, "classroom": x["classroom"], "subject": "BI",
                    "course_id": str(x["course_id"]) if x["course_id"] else None, "status": status,
                    "created_at": iso(x["created_at"])})
    return out


# ---------- class notes (packages/api-client/src/pending-notes.ts) ----------
NOTE_TITLE_MAX, NOTE_BODY_MAX, NOTE_FILE_MAX = 120, 20_000, 1_500_000
SHARED_PAGE_MAX = 10_000_000          # course-generation pages shared as notes can be bigger
NOTE_LINK_SECONDS = 6 * 3600
NOTE_COLS = ("n.id, n.classroom_id, k.name as classroom, t.name as teacher_name, n.title, n.body, n.file_name, "
             "n.file_type, octet_length(n.file_data) as file_size, n.created_at")


def _note_sig(note_id: str, exp: int) -> str:
    import hashlib
    import hmac

    from app.config import get_settings
    return hmac.new(get_settings().supabase_jwt_secret.encode(), f"note:{note_id}:{exp}".encode(),
                    hashlib.sha256).hexdigest()[:32]


def note_out(n: Any, base: str) -> dict[str, Any]:
    file = None
    if n["file_name"]:
        exp = int(engine.utcnow().timestamp()) + NOTE_LINK_SECONDS
        file = {"name": n["file_name"], "type": n["file_type"] or "application/octet-stream", "size": n["file_size"] or 0,
                "url": f"{base}/web/notes/{n['id']}/file?exp={exp}&sig={_note_sig(str(n['id']), exp)}"}
    return {"id": str(n["id"]), "classroom_id": str(n["classroom_id"]), "classroom": n["classroom"],
            "teacher_name": n["teacher_name"] or "", "title": n["title"], "body": n["body"], "file": file,
            "created_at": iso(n["created_at"])}


def _notes(db: Connection, where: str, params: dict[str, Any], request: Request) -> list[dict[str, Any]]:
    rows = db.execute(text(f"select {NOTE_COLS} from class_notes n join classrooms k on k.id=n.classroom_id "
                           f"join users t on t.id=n.teacher_id where {where} order by n.created_at desc"),
                      params).mappings().all()
    base = str(request.base_url).rstrip("/")
    return [note_out(n, base) for n in rows]


def share_course_notes(db: Connection, course_id: Any, classroom_id: Any) -> int:
    """Put the notes a course was generated from into the class's Notes, so students can read them later.
    Each uploaded page becomes one note (once per class). Returns how many were added."""
    course = db.execute(text("select teacher_id, title from courses where id=:c"), {"c": course_id}).mappings().first()
    if course is None:
        return 0
    pages = db.execute(text("select p.id, p.page_no, p.storage_path, p.mime, p.ocr_text, "
                            "count(*) over (partition by p.upload_id) as n from upload_pages p join uploads u "
                            "on u.id=p.upload_id where u.course_id=:c order by u.created_at, p.page_no"),
                       {"c": course_id}).mappings().all()
    added = 0
    for p in pages:
        title = course["title"] if p["n"] == 1 else f"{course['title']} · {p['page_no']}"
        body, name, mime, data = "", None, None, None
        try:
            raw = storage.read(p["storage_path"])
        except (OSError, ValueError):
            raw = None                 # file gone (host disk wiped): fall back to the read text
        if p["mime"] == "text/plain":
            body = raw.decode("utf-8", "replace") if raw is not None else (p["ocr_text"] or "")
        elif raw is not None and len(raw) <= SHARED_PAGE_MAX:
            ext = ai_routes.ALLOWED.get(p["mime"] or "", "")
            name, mime, data = f"{course['title'][:80]}-{p['page_no']}{ext}", p["mime"], raw
        else:
            body = p["ocr_text"] or ""
        if not (body or data):
            continue
        added += db.execute(text(
            "insert into class_notes(classroom_id, teacher_id, title, body, file_name, file_type, file_data, upload_page_id) "
            "values (:k,:t,:ti,:b,:fn,:ft,:fd,:p) on conflict (classroom_id, upload_page_id) do nothing"),
            {"k": classroom_id, "t": course["teacher_id"], "ti": title[:NOTE_TITLE_MAX], "b": body[:NOTE_BODY_MAX],
             "fn": name, "ft": mime, "fd": data, "p": p["id"]}).rowcount
    return added


@router.get("/teacher/notes")
def t_notes(request: Request, db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _teacher(user)
    return _notes(db, "k.teacher_id=:u", {"u": user.id}, request)


@router.get("/me/notes")
def s_notes(request: Request, db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    return _notes(db, "n.classroom_id in (select classroom_id from memberships where user_id=:u)", {"u": user.id}, request)


class NoteFileIn(BaseModel):
    name: str
    type: str = ""
    data_url: str


class NoteIn(BaseModel):
    title: str
    body: str | None = None
    file: NoteFileIn | None = None


@router.post("/classrooms/{classroom_id}/notes", status_code=201)
def t_add_note(classroom_id: str, body: NoteIn, request: Request, db: DbDep, user: UserDep) -> dict[str, Any]:
    import base64
    import binascii
    import re
    _own_class(db, user, classroom_id)
    title, txt = body.title.strip(), (body.body or "").strip()
    if not title or len(title) > NOTE_TITLE_MAX or len(txt) > NOTE_BODY_MAX or not (txt or body.file):
        raise HTTPException(422, {"code": "VALIDATION"})
    name = mime = data = None
    if body.file:
        m = re.match(r"^data:([\w/+.-]+);base64,", body.file.data_url)
        if not m:
            raise HTTPException(422, {"code": "VALIDATION"})
        try:
            data = base64.b64decode(body.file.data_url[m.end():], validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, {"code": "VALIDATION"}) from None
        if len(data) > NOTE_FILE_MAX:
            raise HTTPException(413, {"code": "FILE_TOO_LARGE"})
        name, mime = body.file.name.strip()[:200] or "file", body.file.type or m.group(1)
    nid = db.execute(text("insert into class_notes(classroom_id, teacher_id, title, body, file_name, file_type, file_data) "
                          "values (:k,:t,:ti,:b,:fn,:ft,:fd) returning id"),
                     {"k": classroom_id, "t": user.id, "ti": title, "b": txt, "fn": name, "ft": mime, "fd": data}).scalar_one()
    return _notes(db, "n.id=:n", {"n": nid}, request)[0]


SUMMARY_SCHEMA = {"type": "object", "properties": {"summary": {
    "type": "object", "properties": {"en": {"type": "string"}, "hi": {"type": "string"}, "kn": {"type": "string"}},
    "required": ["en", "hi", "kn"]}}, "required": ["summary"]}
SUMMARY_SYSTEM = ("You summarise a teacher's class notes for school students in India. Use ONLY what the notes say; "
                  "add nothing new. Write 3 to 5 short, simple sentences a 12-year-old can follow, the same summary in "
                  "English (en), Hindi (hi) and Kannada (kn). Keep science words in English in brackets where helpful.")


@router.post("/notes/{note_id}/summary")
def note_summary(note_id: str, db: DbDep, user: UserDep,
                 model: Annotated[Any, Depends(ai_routes.llm)]) -> dict[str, Any]:
    """A short summary of a class note in English, Hindi and Kannada (made once, then kept). For the teacher who owns
    the class and its students; the web app reads it aloud with POST /audio."""
    from app.ai.provider import Part
    n = db.execute(text(
        "select n.id, n.title, n.body, n.file_type, n.file_data, n.summary, p.ocr_text, k.teacher_id from class_notes n "
        "join classrooms k on k.id=n.classroom_id left join upload_pages p on p.id=n.upload_page_id where n.id=:n and "
        "(k.teacher_id=:u or exists (select 1 from memberships m where m.classroom_id=k.id and m.user_id=:u))"),
        {"n": note_id, "u": user.id}).mappings().first()
    if n is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    if n["summary"]:
        return {"summary": n["summary"]}
    ai_routes.rate_limit(f"summary:{user.id}", 30, 3600)
    notes = "\n".join(x for x in (n["body"], n["ocr_text"]) if x).strip()
    parts = None
    if not notes and n["file_data"] is not None and (n["file_type"] or "") in ai_routes.ALLOWED and len(n["file_data"]) <= 8_000_000:
        parts = [Part(n["file_type"], bytes(n["file_data"]))]        # read the photo or PDF itself
    if not notes and parts is None:
        raise HTTPException(422, {"code": "NOTHING_TO_SUMMARISE"})
    try:
        out = model.generate_json(f"Title: {n['title']}\n\nClass notes:\n{notes or '(see the attached file)'}",
                                  SUMMARY_SCHEMA, parts=parts, system=SUMMARY_SYSTEM)
    except Exception as exc:
        raise HTTPException(503, {"code": "AI_UNAVAILABLE", "message": "Could not make a summary right now."}) from exc
    summary = {k: str((out.get("summary") or {}).get(k, "")).strip() for k in ("en", "hi", "kn")}
    if not summary["en"]:
        raise HTTPException(503, {"code": "AI_UNAVAILABLE"})
    db.execute(text("update class_notes set summary=cast(:s as jsonb) where id=:n"),
               {"s": json.dumps(summary, ensure_ascii=False), "n": note_id})
    return {"summary": summary}


@router.delete("/notes/{note_id}", status_code=204)
def t_delete_note(note_id: str, db: DbDep, user: UserDep) -> None:
    _teacher(user)
    if not db.execute(text("delete from class_notes n using classrooms k where n.id=:n and k.id=n.classroom_id "
                           "and k.teacher_id=:t"), {"n": note_id, "t": user.id}).rowcount:
        raise HTTPException(404, {"code": "NOT_FOUND"})


@router.get("/notes/{note_id}/file")
def note_file(note_id: str, db: DbDep, exp: int = 0, sig: str = "") -> Any:
    """The note's file, at the signed link note_out hands out (opens in a new tab: no bearer token)."""
    import hmac
    from urllib.parse import quote

    from fastapi.responses import Response
    if exp < engine.utcnow().timestamp() or not hmac.compare_digest(sig, _note_sig(note_id, exp)):
        raise HTTPException(403, {"code": "LINK_EXPIRED_OR_INVALID"})
    n = db.execute(text("select file_name, file_type, file_data from class_notes where id=:n and file_data is not null"),
                   {"n": note_id}).mappings().first()
    if n is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return Response(bytes(n["file_data"]), media_type=n["file_type"] or "application/octet-stream",
                    headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(n['file_name'])}",
                             "Cache-Control": "private, max-age=3600"})


# =====================================================================================
# PARENT
# =====================================================================================
def _consent_status(db: Connection, lid: Any) -> str:
    g = db.execute(text("select granted from consent_records where learner_id=:l order by created_at desc limit 1"),
                   {"l": lid}).scalar()
    if g is None:
        return "approved" if has_consent(db, lid) else "pending"
    return "approved" if g else "revoked"


def _child_classes(db: Connection, lid: Any) -> list[dict[str, Any]]:
    rows = db.execute(text("select c.id, c.name, t.name as teacher from learners l join memberships m on m.user_id=l.user_id "
                           "join classrooms c on c.id=m.classroom_id join users t on t.id=c.teacher_id where l.id=:l "
                           "union select c.id, c.name, t.name from learners l join call_students cs on cs.id=l.call_student_id "
                           "join classrooms c on c.id=cs.classroom_id join users t on t.id=c.teacher_id where l.id=:l"),
                      {"l": lid}).mappings().all()
    return [{"id": str(x["id"]), "name": x["name"], "teacher_name": x["teacher"]} for x in rows]


def _child_name(db: Connection, lid: Any) -> str:
    return str(db.execute(text("select coalesce(u.name, cs.name) from learners l left join users u on u.id=l.user_id "
                               "left join call_students cs on cs.id=l.call_student_id where l.id=:l"), {"l": lid}).scalar() or "")


def child_out(db: Connection, parent_id: str, lid: Any) -> dict[str, Any]:
    mine = db.execute(text("select 1 from audit_log where actor=:p and action='consent_granted' "
                           "and detail->>'learner_id'=cast(:l as text) limit 1"), {"p": parent_id, "l": str(lid)}).scalar()
    return {"id": str(lid), "name": _child_name(db, lid), "consent_status": _consent_status(db, lid),
            "consent_given_by_me": bool(mine), "classes": _child_classes(db, lid)}


def _linked(db: Connection, user: UserOut, child_id: str) -> None:
    _parent(user)
    if db.execute(text("select 1 from parent_links where parent_id=:p and learner_id=:l"),
                  {"p": user.id, "l": child_id}).scalar() is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})


@router.post("/me/link-code")
def s_link_code(db: DbDep, user: UserDep) -> dict[str, str]:
    code = make_link_code(db, _lid(db, user))
    exp = db.execute(text("select expires_at from link_codes where code=:c"), {"c": code}).scalar_one()
    return {"code": code, "expires_at": iso(exp) or ""}


@router.get("/me/parents")
def s_parents(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    lid = _lid(db, user)
    rows = db.execute(text("select u.id, u.name, u.phone_e164 from parent_links p join users u on u.id=p.parent_id "
                           "where p.learner_id=:l"), {"l": lid}).mappings().all()
    return [{"id": str(x["id"]), "name": x["name"], "phone_last4": (x["phone_e164"] or "")[-4:],
             "linked_at": iso(engine.utcnow()), "consented": _consent_status(db, lid) == "approved"} for x in rows]


@router.delete("/me/parents/{parent_id}", status_code=204)
def s_remove_parent(parent_id: str, db: DbDep, user: UserDep) -> None:
    db.execute(text("delete from parent_links where parent_id=:p and learner_id=:l"),
               {"p": parent_id, "l": _lid(db, user)})


def _code_learner(db: Connection, code: str, lock: bool = False) -> Any:
    row = db.execute(text("select learner_id, used_at is not null as used, expires_at < now() as expired from link_codes "
                          "where code=:c" + (" for update" if lock else "")), {"c": code.strip().upper()}).mappings().first()
    if row is None or row["used"] or row["expired"]:
        raise HTTPException(404, {"code": "CODE_INVALID"})
    return row["learner_id"]


@router.get("/parent/link/{code}")
def p_preview(code: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _parent(user)
    lid = _code_learner(db, code)
    return {"id": str(lid), "name": _child_name(db, lid), "classes": _child_classes(db, lid)}


class LinkIn(BaseModel):
    code: str


@router.post("/parent/link")
def p_link(body: LinkIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    _parent(user)
    lid = _code_learner(db, body.code, lock=True)
    db.execute(text("update link_codes set used_at=now() where code=:c"), {"c": body.code.strip().upper()})
    db.execute(text("insert into parent_links values (:p,:l) on conflict do nothing"), {"p": user.id, "l": lid})
    return child_out(db, user.id, lid)


@router.get("/parent/children")
def p_children(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    _parent(user)
    ids = db.execute(text("select learner_id from parent_links where parent_id=:p"), {"p": user.id}).scalars().all()
    return [child_out(db, user.id, lid) for lid in ids]


@router.post("/parent/children/{child_id}/consent")
def p_consent(child_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _linked(db, user, child_id)
    record_consent(db, child_id, "parent_app", True, actor=user.id)
    return child_out(db, user.id, child_id)


@router.post("/parent/children/{child_id}/revoke-consent")
def p_revoke(child_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _linked(db, user, child_id)
    record_consent(db, child_id, "parent_app", False, actor=user.id)
    return child_out(db, user.id, child_id)


@router.delete("/parent/children/{child_id}", status_code=204)
def p_unlink(child_id: str, db: DbDep, user: UserDep) -> None:
    _linked(db, user, child_id)
    db.execute(text("delete from parent_links where parent_id=:p and learner_id=:l"), {"p": user.id, "l": child_id})


@router.post("/parent/children/{child_id}/deletion")
def p_delete(child_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    """Permanently deletes the child's data (twin, attempts, game rows), as the PRD requires."""
    from app.routers.parent import DeletionIn, request_deletion
    _linked(db, user, child_id)
    request_deletion(DeletionIn(learner_id=child_id), db, user)
    rid = db.execute(text("select id from deletion_requests where learner_id=:l order by created_at desc limit 1"),
                     {"l": child_id}).scalar_one()
    return {"request_id": str(rid), "status": "done", "complete_by": iso(engine.utcnow()) or ""}


@router.get("/parent/children/{child_id}/dashboard")
def p_dashboard(child_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    _linked(db, user, child_id)
    return child_dashboard(db, child_id, user.id)


NOBODY = "00000000-0000-0000-0000-000000000000"


def child_dashboard(db: Connection, child_id: Any, viewer_id: str) -> dict[str, Any]:
    """A child's week for a parent: from the parent screens, or from the child's private parent link."""
    now = engine.utcnow()
    st = engine.load_stats(db, child_id, now, lock=False)

    def lessons(a: int, b: int) -> int:
        return int(db.execute(text("select count(*) from lesson_progress where learner_id=:l and completed_at "
                                   "between now() - make_interval(days => :a) and now() - make_interval(days => :b)"),
                              {"l": child_id, "a": a, "b": b}).scalar_one())

    def acc(a: int, b: int) -> float | None:
        row = db.execute(text("select count(*) as n, count(*) filter (where correct) as ok from answer_attempts where "
                              "learner_id=:l and created_at between now() - make_interval(days => :a) and "
                              "now() - make_interval(days => :b)"), {"l": child_id, "a": a, "b": b}).mappings().one()
        return round(row["ok"] / row["n"], 2) if row["n"] else None

    this_w, last_w = lessons(7, 0), lessons(14, 7)
    a_this, a_last = acc(7, 0), acc(14, 7)
    word = "needs_practice" if (a_this or 0) < 0.5 else ("improving" if a_last is not None and a_this is not None
                                                         and a_this > a_last + 0.05 else "steady")
    concepts = twin_read.weakest(db, child_id, now)
    minutes = round(st["play_seconds_today"] / 60)
    assignments = db.execute(text(
        "select c.id, c.title, k.name as classroom from courses c join course_assignments a on a.course_id=c.id "
        "join classrooms k on k.id=a.classroom_id join memberships m on m.classroom_id=k.id join learners l "
        "on l.user_id=m.user_id where l.id=:l and c.status='published'"), {"l": child_id}).mappings().all()
    done_courses = set(db.execute(text("select course_id from course_completions where learner_id=:l"),
                                  {"l": child_id}).scalars().all())
    summary = (f"{_child_name(db, child_id)} finished {this_w} lessons this week"
               f"{f' with {round(a_this * 100)}% accuracy' if a_this is not None else ''}.")
    return {"child": child_out(db, viewer_id, child_id), "has_activity": this_w > 0 or a_this is not None,
            "week": {"lessons_this_week": this_w, "lessons_last_week": last_w,
                     "arrow": "up" if this_w > last_w else "down" if this_w < last_w else "same",
                     "minutes_this_week": minutes, "streak": engine.display_streak(st, now)},
            "accuracy": {"this_week": a_this, "last_week": a_last, "word": word},
            "subjects": [{"subject": "BI", "strongest": tri(concepts[-1]["concept"]) if concepts else None,
                          "weakest": tri(concepts[0]["concept"]) if concepts else None}],
            "assignments": [{"course_id": str(x["id"]), "title": tri(x["title"]), "classroom": x["classroom"], "due_at": None,
                             "status": "done" if x["id"] in done_courses else "pending"} for x in assignments],
            "classes": _child_classes(db, child_id), "summary": tri(summary)}



# ---------- private parent link: each student has one link a parent can open without signing in ----------
def _parent_token(db: Connection, learner_id: Any, fresh: bool = False) -> str:
    import secrets
    if fresh:
        db.execute(text("delete from parent_share_links where learner_id=:l"), {"l": learner_id})
    tok = db.execute(text("select token from parent_share_links where learner_id=:l"), {"l": learner_id}).scalar()
    if tok is None:
        tok = secrets.token_urlsafe(18)
        db.execute(text("insert into parent_share_links(learner_id, token) values (:l,:t)"), {"l": learner_id, "t": tok})
    return str(tok)


def _link_out(tok: str) -> dict[str, str]:
    return {"token": tok, "path": f"/p/{tok}"}


@router.get("/me/parent-link")
def s_parent_link(db: DbDep, user: UserDep) -> dict[str, str]:
    """The student's private link for their parent (made on first ask)."""
    return _link_out(_parent_token(db, _lid(db, user)))


@router.post("/me/parent-link/reset")
def s_parent_link_reset(db: DbDep, user: UserDep) -> dict[str, str]:
    """A new link; the old one stops working."""
    return _link_out(_parent_token(db, _lid(db, user), fresh=True))


@router.get("/classrooms/{classroom_id}/students/{student_id}/parent-link")
def t_parent_link(classroom_id: str, student_id: str, db: DbDep, user: UserDep) -> dict[str, str]:
    """The teacher can hand a student's parent link to the parent."""
    c = _own_class(db, user, classroom_id)
    s = next((x for x in _students(db, c["id"]) if str(x["id"]) == student_id), None)
    if s is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return _link_out(_parent_token(db, s["lid"]))


@router.get("/share/{token}")
def shared_dashboard(token: str, request: Request, db: DbDep) -> dict[str, Any]:
    """The parent link page: the child's week, with no sign-in. The token is the only key."""
    from app.auth.service import rate_limit
    rate_limit(f"share-ip:{request.client.host if request.client else '?'}", 120, 3600)
    lid = db.execute(text("select learner_id from parent_share_links where token=:t"), {"t": token}).scalar()
    if lid is None:
        raise HTTPException(404, {"code": "LINK_NOT_FOUND"})
    return child_dashboard(db, lid, NOBODY)
