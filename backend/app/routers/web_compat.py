"""Compatibility layer for the web app in apps/web (Sandra's frontend), mounted at /web.

The web app was written against an earlier backend contract (packages/api-client/openapi/
backend.json and src/pending-*.ts). These routes speak that contract exactly, on top of this
backend's real logic (engine, twin, AI, calls), so the frontend only changes its base URL and
login adapter. Shapes: three-language text {en, hi, kn}, subjects BI/CH/PH, language modes
hindi/kannada, question types multiple_choice/true_false/match_pairs/fill_formula."""
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.auth import service as auth_service
from app.auth.sms import SmsProvider, get_sms
from app.config import get_settings
from app.deps import DbDep, UserDep, learner_id_for
from app.game import engine
from app.game import rules as r
from app.people import create_learner
from app.routers import ai as ai_routes
from app.routers.auth import UserOut
from app.twin import read as twin_read

log = logging.getLogger(__name__)
router = APIRouter(prefix="/web", tags=["web-compat"])
SUBJECT_CODE = {"biology": "BI", "chemistry": "CH", "physics": "PH"}
LANG_MODE = {"hi": "hindi", "kn": "kannada", "en": "hindi"}
MODE_LANG = {"hindi": "hi", "kannada": "kn"}
DEMO_TEST_CODE = "123456"


# ---------- shape helpers ----------
def tri(v: Any) -> dict[str, str]:
    """Any content (plain text or {hi,kn,en,regional,english}) as {en, hi, kn}."""
    if isinstance(v, dict):
        en = v.get("en") or v.get("english") or v.get("regional") or v.get("hi") or ""
        return {"en": str(en), "hi": str(v.get("hi") or v.get("regional") or en),
                "kn": str(v.get("kn") or v.get("regional") or en)}
    s = "" if v is None else str(v)
    from app.titles import lookup  # a course/lesson title translated into every language
    return dict(lookup(s) or {"en": s, "hi": s, "kn": s})


def match_key(o: Any) -> str:
    return o if isinstance(o, str) else json.dumps(o, ensure_ascii=False, separators=(",", ":"))


def iso(d: datetime | None) -> str | None:
    return d.astimezone(UTC).isoformat() if d else None


def stats_out(db: Connection, lid: Any) -> dict[str, Any]:
    now = engine.utcnow()
    st = engine.load_stats(db, lid, now, lock=False)
    refill = (st["hearts_updated_at"] + timedelta(minutes=r.HEART_REFILL_MINUTES)
              if st["hearts"] < r.MAX_HEARTS else None)
    streak = engine.display_streak(st, now)
    return {"xp_total": st["xp"], "xp_today": st["today_xp"], "daily_goal": st["daily_goal"],
            "hearts": st["hearts"], "max_hearts": r.MAX_HEARTS, "refill_at": iso(refill),
            "streak": streak, "longest_streak": max(streak, int(st["streak"]))}


def term_key(english: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (english or "").lower()).strip("_") or "term"


def term_content(t: Any) -> dict[str, Any]:
    forms = {"en": t["english"], "hi": t["regional"], "kn": t["regional"]}
    meaning = tri(t["definition"]) if t["definition"] else {"en": "", "hi": "", "kn": ""}
    return {"key": term_key(t["english"]), "forms": forms, "transliteration": forms, "formal": forms,
            "meaning": meaning, "analogy": {"en": "", "hi": "", "kn": ""}, "related": [], "source_page": 1}


def question_out(q: Any, page: int | None = None) -> dict[str, Any] | None:
    """Our question row as the web app's QuestionOut. fill_in has no chips, so it is skipped."""
    blank = {"en": "", "hi": "", "kn": ""}
    common = {"prompt": tri(q["prompt"]), "explanation": blank, "source_page": page or 1}
    if q["kind"] == "mcq":
        typ, content = "multiple_choice", {**common, "options": [{"text": tri(o)} for o in (q["options"] or [])]}
    elif q["kind"] == "true_false":
        typ, content = "true_false", {**common, "statement": tri(q["prompt"]),
                                      "prompt": {"en": "True or false?", "hi": "सही या गलत?", "kn": "ಸರಿ ಅಥವಾ ತಪ್ಪು?"}}
    elif q["kind"] == "match":
        opts = q["options"] or []
        n = len(opts) // 2
        lefts, rights = opts[:n], opts[n:]
        by_key = {match_key(x): x for x in rights}
        ans = q["answer"] if isinstance(q["answer"], dict) else {}
        pairs = [{"left": {"text": tri(lf)}, "right": {"text": tri(by_key.get(ans.get(match_key(lf), ""), ""))}}
                 for lf in lefts]
        typ, content = "match_pairs", {**common, "pairs": pairs}
    else:
        return None
    return {"id": str(q["id"]), "position": q["position"] or 0, "type": typ, "content": content,
            "source_page": page or 1, "confidence": 1.0, "flag_reason": None,
            "call_safe": bool(q.get("call_safe")), "teacher_edited": False}


def _question_rows(db: Connection, lesson_id: str) -> list[Any]:
    return list(db.execute(text(
        "select q.id, q.kind, q.prompt, q.options, q.answer, q.position, q.call_safe, p.page_no "
        "from questions q left join upload_pages p on p.id=q.source_page_id "
        "where q.lesson_id=:l order by q.position, q.id"), {"l": lesson_id}).mappings().all())


def lesson_out(db: Connection, lesson_id: str, only_ids: set[str] | None = None) -> dict[str, Any]:
    row = db.execute(text("select l.id, l.title, l.kind, l.content, u.course_id, c.status from lessons l "
                          "join units u on u.id=l.unit_id join courses c on c.id=u.course_id where l.id=:l"),
                     {"l": lesson_id}).mappings().one()
    qs = [x for q in _question_rows(db, lesson_id) if (only_ids is None or str(q["id"]) in only_ids)
          and (x := question_out(q, q["page_no"])) is not None]
    terms = db.execute(text("select english, regional, definition from terms where course_id=:c"),
                       {"c": row["course_id"]}).mappings().all()
    return {"id": str(row["id"]), "course_id": str(row["course_id"]), "title": tri(row["title"]),
            "generation_status": "ready", "published": row["status"] == "published", "questions": qs,
            "terms": {term_key(t["english"]): term_content(t) for t in terms},
            # additive (not in the original contract): quiz | video | reading | interactive, and its media
            "kind": row["kind"], "media": _media(row["kind"], row["content"])}


def _media(kind: str, content: Any) -> dict[str, Any] | None:
    c = content or {}
    if kind == "video":
        return {"video_url": c.get("url"), "transcript": tri(c.get("transcript")) if c.get("transcript") else None}
    if c.get("body"):
        return {"reading": tri(c.get("body"))}
    return None


# ---------- auth (our OTP and tokens, not Supabase) ----------
class OtpIn(BaseModel):
    phone: str


class VerifyIn(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)


class ClassKeyIn(BaseModel):
    class_key: str
    name: str = Field(min_length=1, max_length=40)


def _session(user_id: Any, role: str) -> dict[str, Any]:
    from app.auth.tokens import TTL, issue_token
    return {"access_token": issue_token(user_id, role), "token_type": "bearer", "expires_in": TTL}


def _demo_phone(phone: str) -> bool:
    """In DEMO_MODE every Indian mobile number (starting 6-9) signs in with 123456 and no SMS is sent.
    Turn DEMO_MODE off for real SMS codes (Twilio Verify)."""
    from app.demo import DEMO_PHONES
    return get_settings().demo_mode and (phone in DEMO_PHONES or re.fullmatch(r"\+91[6-9]\d{9}", phone) is not None)


@router.post("/auth/otp")
def web_otp(body: OtpIn, request: Request, db: DbDep,
            sms: Annotated[SmsProvider, Depends(get_sms)]) -> dict[str, Any]:
    phone = auth_service.normalize_phone(body.phone)
    if _demo_phone(phone):                       # demo mode: code 123456, no SMS
        return {"sent": True, "dev_code": DEMO_TEST_CODE}
    auth_service.rate_limit(f"otp-ip:{request.client.host if request.client else '?'}", 20, 3600)
    code = auth_service.request_otp(db, sms, phone)
    s = get_settings()
    fallback = s.demo_mode and code == auth_service.DEMO_FALLBACK_CODE
    return {"sent": True, "dev_code": code if (s.demo_mode and (s.use_fake_sms or fallback)) else None}


@router.post("/auth/verify")
def web_verify(body: VerifyIn, db: DbDep) -> dict[str, Any]:
    """Like /v1/auth/verify, but a new phone gets an unregistered account; onboarding (PUT /me)
    then sets name, role and language."""
    phone = auth_service.normalize_phone(body.phone)
    if not (_demo_phone(phone) and body.code == DEMO_TEST_CODE):
        auth_service.check_otp(db, phone, body.code)     # our own code, or Twilio Verify's
    user = db.execute(text("select id, role from users where phone_e164=:p"), {"p": phone}).mappings().first()
    if user is None:
        uid = db.execute(text("insert into users(role, name, phone_e164, registered) values "
                              "('student', '', :p, false) returning id"), {"p": phone}).scalar_one()
        return _session(uid, "student")
    return _session(user["id"], user["role"])


@router.post("/auth/class-key")
def web_class_key(body: ClassKeyIn, request: Request, db: DbDep) -> dict[str, Any]:
    auth_service.rate_limit(f"key-ip:{request.client.host if request.client else '?'}", 15, 60)
    try:
        s = auth_service.class_key_login(db, body.class_key.replace("-", ""), body.name)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(404, {"code": "KEY_NOT_FOUND"}) from exc
        raise
    return {"access_token": s["access_token"], "token_type": "bearer", "expires_in": s["expires_in"]}


# ---------- me / onboarding ----------
class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    language_mode: str
    roles: list[str]


def _me(db: Connection, user_id: str) -> dict[str, Any]:
    u = db.execute(text("select id, name, phone_e164, role, language, registered from users where id=:i"),
                   {"i": user_id}).mappings().one()
    return {"id": str(u["id"]), "registered": u["registered"], "name": u["name"] or None,
            "phone": u["phone_e164"], "roles": [u["role"]] if u["registered"] else [],
            "language_mode": LANG_MODE.get(u["language"]) if u["registered"] else None}


@router.get("/me")
def get_me(db: DbDep, user: UserDep) -> dict[str, Any]:
    return _me(db, user.id)


@router.put("/me")
def put_me(body: ProfileIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    role = next((x for x in body.roles if x in ("student", "teacher", "parent")), None)
    if role is None or body.language_mode not in MODE_LANG:
        raise HTTPException(422, {"code": "VALIDATION"})
    db.execute(text("update users set name=:n, language=:l, role=:r, registered=true where id=:i"),
               {"n": body.name.strip(), "l": MODE_LANG[body.language_mode], "r": role, "i": user.id})
    if role == "student" and db.execute(text("select id from learners where user_id=:u"),
                                        {"u": user.id}).scalar() is None:
        create_learner(db, user_id=user.id)
    return _me(db, user.id)


def _lid(db: Connection, user: UserOut) -> Any:
    if user.role != "student":
        raise HTTPException(403, {"code": "FORBIDDEN"})
    return learner_id_for(db, user.id)


@router.get("/me/stats")
def me_stats(db: DbDep, user: UserDep) -> dict[str, Any]:
    return stats_out(db, _lid(db, user))


class GoalIn(BaseModel):
    goal: int


@router.put("/me/daily-goal")
def me_goal(body: GoalIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    goal = min((20, 50, 100), key=lambda g: abs(g - body.goal))
    db.execute(text("update student_stats set daily_goal=:g where learner_id=:l"), {"g": goal, "l": lid})
    return stats_out(db, lid)


# ---------- classes (student side) ----------
def _classroom_out_student(db: Connection, c: Any) -> dict[str, Any]:
    n = db.execute(text("select count(*) from memberships where classroom_id=:c"), {"c": c["id"]}).scalar_one()
    return {"id": str(c["id"]), "name": c["name"], "teacher_name": c["teacher_name"], "subject": "BI",
            "grade": 7, "student_count": n, "joined_at": iso(c.get("created_at") or engine.utcnow())}


@router.get("/me/classrooms")
def me_classrooms(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    rows = db.execute(text("select c.id, c.name, c.created_at, t.name as teacher_name from memberships m "
                           "join classrooms c on c.id=m.classroom_id join users t on t.id=c.teacher_id "
                           "where m.user_id=:u order by c.name"), {"u": user.id}).mappings().all()
    return [_classroom_out_student(db, dict(x)) for x in rows]


def _by_key(db: Connection, key: str) -> Any:
    c = db.execute(text("select c.id, c.name, c.created_at, t.name as teacher_name from classrooms c "
                        "join users t on t.id=c.teacher_id where c.class_key=:k"),
                   {"k": key.replace("-", "").strip().upper()}).mappings().first()
    if c is None:
        raise HTTPException(404, {"code": "KEY_NOT_FOUND"})
    return dict(c)


@router.get("/classrooms/preview/{key}")
def classroom_preview(key: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    c = _by_key(db, key)
    out = _classroom_out_student(db, c)
    out.pop("joined_at")
    return {**out, "allowed_language_modes": ["hindi", "kannada"]}


class JoinIn(BaseModel):
    key: str


@router.post("/classrooms/join")
def join(body: JoinIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    _lid(db, user)
    c = _by_key(db, body.key)
    db.execute(text("insert into memberships values (:c,:u) on conflict do nothing"), {"c": c["id"], "u": user.id})
    return _classroom_out_student(db, c)


# ---------- learning ----------
def _student_courses(db: Connection, user_id: str) -> list[Any]:
    return list(db.execute(text(
        "select distinct c.id, c.title, c.subject, c.created_at from courses c join course_assignments a "
        "on a.course_id=c.id join memberships m on m.classroom_id=a.classroom_id "
        "where m.user_id=:u and c.status='published' order by c.created_at"), {"u": user_id}).mappings().all())


def _path(db: Connection, lid: Any, course: Any) -> dict[str, Any]:
    rows = db.execute(text(
        "select u.id as uid, u.title as ut, l.id as lid, l.title as lt, l.position, "
        "p.completed_at is not null as done, "
        "(select count(*) from questions q where q.lesson_id=l.id and q.kind<>'fill_in') as qn "
        "from units u join lessons l on l.unit_id=u.id left join lesson_progress p on p.lesson_id=l.id "
        "and p.learner_id=:l where u.course_id=:c order by u.position, l.position"),
        {"l": lid, "c": course["id"]}).mappings().all()
    units: dict[str, Any] = {}
    current = None
    done = 0
    for i, x in enumerate(rows, start=1):
        if x["done"]:
            state, done = "done", done + 1
        elif current is None:
            state, current = "current", str(x["lid"])
        else:
            state = "locked"
        units.setdefault(str(x["uid"]), {"id": str(x["uid"]), "title": tri(x["ut"]), "lessons": []})["lessons"].append(
            {"id": str(x["lid"]), "position": i, "title": tri(x["lt"]), "state": state,
             "generation_status": "ready", "question_count": x["qn"], "unlocked_by": None})
    return {"course_id": str(course["id"]), "title": tri(course["title"]),
            "subject": SUBJECT_CODE.get(course["subject"], "BI"), "is_personal": False,
            "units": list(units.values()), "done_count": done, "lesson_count": len(rows),
            "current_lesson_id": current}


@router.get("/courses/{course_id}/path")
def course_path(course_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    course = next((c for c in _student_courses(db, user.id) if str(c["id"]) == course_id), None)
    if course is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    return _path(db, lid, course)


@router.get("/me/courses")
def me_courses(db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    lid = _lid(db, user)
    out = []
    for c in _student_courses(db, user.id):
        p = _path(db, lid, c)
        out.append({"id": str(c["id"]), "title": tri(c["title"]), "subject": p["subject"], "grade": 7,
                    "status": "published", "is_personal": False, "ai_made": True,
                    "lesson_count": p["lesson_count"], "published_count": p["lesson_count"]})
    return out


@router.get("/me/home")
def me_home(db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    me = _me(db, user.id)
    courses, cont = [], None
    for c in _student_courses(db, user.id):
        p = _path(db, lid, c)
        courses.append({"id": p["course_id"], "title": p["title"], "subject": p["subject"], "is_personal": False,
                        "ai_made": True, "lesson_count": p["lesson_count"],
                        "percent_complete": round(100 * p["done_count"] / p["lesson_count"]) if p["lesson_count"] else 0})
        if cont is None and p["current_lesson_id"]:
            flat = [le for u in p["units"] for le in u["lessons"]]
            cur = next(le for le in flat if le["id"] == p["current_lesson_id"])
            cont = {"course_id": p["course_id"], "course_title": p["title"], "subject": p["subject"],
                    "lesson_id": cur["id"], "lesson_title": cur["title"], "lesson_number": cur["position"],
                    "lesson_count": p["lesson_count"], "generation_status": "ready", "due_at": None}
    classes = [{"id": c["id"], "name": c["name"], "subject": c["subject"], "teacher_name": c["teacher_name"],
                "new_lessons": 0} for c in me_classrooms(db, user)]
    return {"name": me["name"] or "", "language_mode": me["language_mode"] or "hindi",
            "stats": stats_out(db, lid), "continue_lesson": cont, "classes": classes, "courses": courses}


@router.post("/lessons/{lesson_id}/start")
def start(lesson_id: str, db: DbDep, user: UserDep,
          model: Annotated[Any, Depends(ai_routes.llm)]) -> dict[str, Any]:
    lid = _lid(db, user)
    engine.check_lesson_access(db, user.id, lesson_id)
    if db.execute(text("select not exists (select 1 from questions where lesson_id=:l)"), {"l": lesson_id}).scalar():
        # a lesson with no quiz yet (older courses): make its questions now, from the class notes
        from app.ai.pipeline import generate_more
        try:
            generate_more(db, model, lesson_id, 6)
        except Exception:
            log.warning("could not make questions for lesson %s", lesson_id, exc_info=True)
    served = engine.start_lesson(db, user.id, lesson_id)
    ids = {q["id"] for q in served}
    course = db.execute(text("select u.course_id from lessons l join units u on u.id=l.unit_id where l.id=:l"),
                        {"l": lesson_id}).scalar()
    known = twin_read.term_mastery(db, lid, course, engine.utcnow()) if course else {}
    return {"lesson": lesson_out(db, lesson_id, ids), "stats": stats_out(db, lid),
            "term_mastery": {term_key(k): v for k, v in known.items()}}


class AttemptIn(BaseModel):
    question_id: str
    answer: dict[str, Any]
    retry: bool = False
    time_ms: int | None = None


KIND_TO_TYPE = {"mcq": "multiple_choice", "true_false": "true_false", "match": "match_pairs", "fill_in": "fill_formula"}


def _to_our_answer(q: Any, a: dict[str, Any]) -> Any:
    # the web app sends the bare answer ({index} / {value} / {pairs, mistakes} / {chip}); "type" is optional
    t = a.get("type") or KIND_TO_TYPE.get(q["kind"])
    if t == "multiple_choice":
        opts = q["options"] or []
        i = int(a.get("index", -1))
        return opts[i] if 0 <= i < len(opts) else None
    if t == "true_false":
        return bool(a.get("value"))
    if t == "match_pairs":
        opts = q["options"] or []
        n = len(opts) // 2
        lefts, rights = opts[:n], opts[n:]
        # the web app shows the rights in the order of our answer's pairing, so map through it
        ans = q["answer"] if isinstance(q["answer"], dict) else {}
        by_key = {match_key(x): x for x in rights}
        shown = [by_key.get(ans.get(match_key(lf), ""), "") for lf in lefts]
        return {match_key(lefts[li]): match_key(shown[ri]) for li, ri in a.get("pairs", [])
                if 0 <= li < n and 0 <= ri < len(shown)}
    if t == "fill_formula":
        return a.get("chip", "")
    return None


def _correct_answer_out(q: Any) -> dict[str, Any]:
    if q["kind"] == "mcq":
        opts = [json.dumps(o, sort_keys=True) for o in (q["options"] or [])]
        key = json.dumps(q["answer"], sort_keys=True)
        return {"index": opts.index(key) if key in opts else 0}
    if q["kind"] == "true_false":
        return {"value": q["answer"] in (True, "true", "True")}
    if q["kind"] == "match":
        n = len(q["options"] or []) // 2
        return {"pairs": [[i, i] for i in range(n)]}
    return {"text": tri(q["answer"])}


@router.post("/attempts")
def attempt(body: AttemptIn, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    q = db.execute(text("select id, kind, options, answer from questions where id=:q"),
                   {"q": body.question_id}).mappings().first()
    if q is None:
        raise HTTPException(404, {"code": "NOT_FOUND"})
    given = _to_our_answer(q, body.answer)
    res = engine.record_attempt(db, user.id, body.question_id, given)
    return {"correct": res["correct"], "correct_answer": _correct_answer_out(q),
            "explanation": {"en": "", "hi": "", "kn": ""}, "xp_delta": res["xp_gained"],
            "heart_lost": not res["correct"], "stats": stats_out(db, lid)}


@router.post("/lessons/{lesson_id}/complete")
def complete(lesson_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    lid = _lid(db, user)
    before = engine.display_streak(engine.load_stats(db, lid, engine.utcnow(), lock=False), engine.utcnow())
    res = engine.complete_lesson(db, user.id, lesson_id)
    acc = db.execute(text("select accuracy from lesson_progress where learner_id=:l and lesson_id=:le"),
                     {"l": lid, "le": lesson_id}).scalar()
    return {"xp_earned": res["xp_gained"], "accuracy": float(acc or 0), "streak": res["stats"]["streak"],
            "streak_extended": res["stats"]["streak"] > before, "stats": stats_out(db, lid)}


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, db: DbDep, user: UserDep) -> dict[str, Any]:
    """Students get the playable lesson; teachers get the same shape plus answers, flagged first."""
    if user.role in ("teacher", "admin"):
        from app.routers.web_compat_b import t_lesson_review
        return t_lesson_review(lesson_id, db, user)
    engine.check_lesson_access(db, user.id, lesson_id)
    return lesson_out(db, lesson_id)


@router.get("/courses/{course_id}/terms")
def terms(course_id: str, db: DbDep, user: UserDep) -> list[dict[str, Any]]:
    lid = _lid(db, user)
    rows = db.execute(text("select t.id, t.english, t.regional, t.definition, "
                           "exists (select 1 from saved_terms s where s.term_id=t.id and s.learner_id=:l) as saved "
                           "from terms t where t.course_id=:c order by t.english"),
                      {"c": course_id, "l": lid}).mappings().all()
    known = twin_read.term_mastery(db, lid, course_id, engine.utcnow())     # Student Twin, with forgetting
    return [{"key": term_key(t["english"]), "content": term_content(t), "source_page": 1,
             "saved": t["saved"], "mastery": known.get(t["english"])} for t in rows]


def _term_id(db: Connection, course_id: str, key: str) -> Any:
    for t in db.execute(text("select id, english from terms where course_id=:c"), {"c": course_id}).mappings():
        if term_key(t["english"]) == key:
            return t["id"]
    raise HTTPException(404, {"code": "NOT_FOUND"})


@router.put("/me/saved-terms/{course_id}/{key}", status_code=204)
def save_term(course_id: str, key: str, db: DbDep, user: UserDep) -> None:
    db.execute(text("insert into saved_terms values (:l,:t) on conflict do nothing"),
               {"l": _lid(db, user), "t": _term_id(db, course_id, key)})


@router.delete("/me/saved-terms/{course_id}/{key}", status_code=204)
def unsave_term(course_id: str, key: str, db: DbDep, user: UserDep) -> None:
    db.execute(text("delete from saved_terms where learner_id=:l and term_id=:t"),
               {"l": _lid(db, user), "t": _term_id(db, course_id, key)})


class DoubtIn(BaseModel):
    course_id: str | None = None
    question_id: str | None = None
    term_key: str | None = None
    text: str = Field(min_length=2, max_length=500)
    mode: str = "ask"


@router.post("/doubts")
def doubt(body: DoubtIn, db: DbDep, user: UserDep,
          model: Annotated[Any, Depends(ai_routes.llm)]) -> dict[str, Any]:
    _lid(db, user)
    res = ai_routes.ask_doubt(ai_routes.DoubtIn(text=body.text), db, user, model)
    used = db.execute(text("select count(*) from doubts d join learners l on l.id=d.learner_id "
                           "where l.user_id=:u and d.created_at > now() - interval '1 day'"),
                      {"u": user.id}).scalar_one()
    page = (res["citation"] or {}).get("page")
    return {"id": res["id"], "answer": tri(res["answer"]), "in_notes": res["from_notes"],
            "source_pages": [page] if page else [], "doubts_left_today": max(0, 30 - int(used))}


class AudioIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str = Field("hi", pattern="^(hi|kn|en)$")


@router.post("/audio")
def audio(body: AudioIn, request: Request, db: DbDep, user: UserDep) -> dict[str, str]:
    out = ai_routes.make_audio(ai_routes.AudioIn(text=body.text, language=body.language), db, user)
    return {"url": str(request.base_url).rstrip("/") + out["url"]}

