import json
import secrets
from datetime import time
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.auth.service import normalize_phone
from app.deps import DbDep, Student, Teacher, learner_id_for
from app.game import engine
from app.people import create_learner

router = APIRouter(tags=["teacher"])
KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"      # no look-alike characters


def new_key(n: int = 8) -> str:
    return "".join(secrets.choice(KEY_CHARS) for _ in range(n))


def own_classroom(db: Connection, teacher_id: str, classroom_id: str) -> None:
    ok = db.execute(text("select exists (select 1 from classrooms where id=:c and teacher_id=:t)"),
                    {"c": classroom_id, "t": teacher_id}).scalar()
    if not ok:
        raise HTTPException(404, "Class not found")


def own_course(db: Connection, teacher_id: str, course_id: str) -> None:
    ok = db.execute(text("select exists (select 1 from courses where id=:c and teacher_id=:t)"),
                    {"c": course_id, "t": teacher_id}).scalar()
    if not ok:
        raise HTTPException(404, "Course not found")


# ---------- classes ----------
class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class ClassPatch(BaseModel):
    league_enabled: bool | None = None
    school_consent: bool | None = None


@router.post("/classrooms", status_code=201)
def create_class(body: ClassIn, db: DbDep, user: Teacher) -> dict[str, Any]:
    key = new_key()
    row = db.execute(text("insert into classrooms(teacher_id, name, class_key) values "
                          "(:t,:n,:k) returning id, name, class_key"),
                     {"t": user.id, "n": body.name, "k": key}).mappings().one()
    return {**dict(row), "id": str(row["id"])}


@router.get("/classrooms")
def my_classes(db: DbDep, user: Teacher) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select c.id, c.name, c.class_key, c.league_enabled, c.school_consent, "
        "(select count(*) from memberships m where m.classroom_id=c.id) as students "
        "from classrooms c where c.teacher_id=:t order by c.created_at"),
        {"t": user.id}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


@router.patch("/classrooms/{classroom_id}")
def patch_class(classroom_id: str, body: ClassPatch, db: DbDep, user: Teacher) -> dict[str, Any]:
    own_classroom(db, user.id, classroom_id)
    if body.league_enabled is not None:
        db.execute(text("update classrooms set league_enabled=:v where id=:c"),
                   {"v": body.league_enabled, "c": classroom_id})
    if body.school_consent is not None:
        db.execute(text("update classrooms set school_consent=:v where id=:c"),
                   {"v": body.school_consent, "c": classroom_id})
        db.execute(text("insert into audit_log(actor, action, detail) values (:a,:k,"
                        "cast(:d as jsonb))"),
                   {"a": user.id, "k": "school_consent_" + ("on" if body.school_consent else "off"),
                    "d": json.dumps({"classroom_id": classroom_id})})
    row = db.execute(text("select league_enabled, school_consent from classrooms where id=:c"),
                     {"c": classroom_id}).mappings().one()
    return dict(row)


@router.post("/classrooms/join")
def join_class(body: dict[str, str], db: DbDep, user: Student) -> dict[str, Any]:
    key = (body.get("class_key") or "").strip().upper()
    c = db.execute(text("select id, name from classrooms where class_key=:k"),
                   {"k": key}).mappings().first()
    if c is None:
        raise HTTPException(404, "Class key not found")
    db.execute(text("insert into memberships values (:c,:u) on conflict do nothing"),
               {"c": c["id"], "u": user.id})
    return {"classroom_id": str(c["id"]), "name": c["name"]}


# ---------- courses ----------
class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subject: Literal["biology", "chemistry", "physics"]


class QuestionIn(BaseModel):
    kind: Literal["mcq", "true_false", "match", "fill_in"]
    prompt: dict[str, Any]
    options: list[Any] | None = None
    answer: Any
    concept: str | None = None
    call_safe: bool = False
    flagged: bool = False
    source_page_id: str | None = None


class LessonIn(BaseModel):
    title: str
    questions: list[QuestionIn] = []


class UnitIn(BaseModel):
    title: str
    lessons: list[LessonIn] = []


class ContentIn(BaseModel):
    units: list[UnitIn]


class AssignIn(BaseModel):
    classroom_id: str


@router.post("/courses", status_code=201)
def create_course(body: CourseIn, db: DbDep, user: Teacher) -> dict[str, Any]:
    cid = db.execute(text("insert into courses(teacher_id, title, subject) values (:t,:n,:s) "
                          "returning id"), {"t": user.id, "n": body.title, "s": body.subject}
                     ).scalar_one()
    return {"id": str(cid), "status": "draft"}


@router.post("/courses/{course_id}/content", status_code=201)
def add_content(course_id: str, body: ContentIn, db: DbDep, user: Teacher) -> dict[str, int]:
    """Bulk add units, lessons and questions. This is the hand-off point for P3's AI pipeline."""
    own_course(db, user.id, course_id)
    base = int(db.execute(text("select coalesce(max(position),0) from units where course_id=:c"),
                          {"c": course_id}).scalar_one())
    n_q = 0
    for ui, unit in enumerate(body.units, start=1):
        uid = db.execute(text("insert into units(course_id, position, title) values (:c,:p,:t) "
                              "returning id"),
                         {"c": course_id, "p": base + ui, "t": unit.title}).scalar_one()
        for li, lesson in enumerate(unit.lessons, start=1):
            lid = db.execute(text("insert into lessons(unit_id, position, title) values "
                                  "(:u,:p,:t) returning id"),
                             {"u": uid, "p": li, "t": lesson.title}).scalar_one()
            for qi, q in enumerate(lesson.questions, start=1):
                db.execute(text(
                    "insert into questions(lesson_id, kind, prompt, options, answer, concept, "
                    "call_safe, flagged, source_page_id, position) values (:l,:k,"
                    "cast(:p as jsonb),cast(:o as jsonb),cast(:a as jsonb),:c,:cs,:f,:sp,:pos)"),
                    {"l": lid, "k": q.kind, "p": json.dumps(q.prompt), "pos": qi,
                     "o": json.dumps(q.options) if q.options is not None else None,
                     "a": json.dumps(q.answer), "c": q.concept, "cs": q.call_safe,
                     "f": q.flagged, "sp": q.source_page_id})
                n_q += 1
    return {"units": len(body.units), "questions": n_q}


@router.get("/courses/{course_id}")
def get_course(course_id: str, db: DbDep, user: Teacher) -> dict[str, Any]:
    """Review screen data: flagged questions come first inside each lesson."""
    own_course(db, user.id, course_id)
    course = db.execute(text("select id, title, subject, status from courses where id=:c"),
                        {"c": course_id}).mappings().one()
    rows = db.execute(text(
        "select u.id as uid, u.title as ut, l.id as lid, l.title as lt, q.id as qid, q.kind, "
        "q.prompt, q.options, q.answer, q.concept, q.call_safe, q.flagged "
        "from units u join lessons l on l.unit_id=u.id left join questions q on q.lesson_id=l.id "
        "where u.course_id=:c order by u.position, l.position, q.flagged desc, q.position, q.id"),
        {"c": course_id}).mappings().all()
    units: dict[str, Any] = {}
    lessons: dict[str, Any] = {}
    for x in rows:
        u = units.setdefault(str(x["uid"]), {"id": str(x["uid"]), "title": x["ut"], "lessons": []})
        if str(x["lid"]) not in lessons:
            lessons[str(x["lid"])] = {"id": str(x["lid"]), "title": x["lt"], "questions": []}
            u["lessons"].append(lessons[str(x["lid"])])
        if x["qid"] is not None:
            lessons[str(x["lid"])]["questions"].append({
                "id": str(x["qid"]), "kind": x["kind"], "prompt": x["prompt"],
                "options": x["options"], "answer": x["answer"], "concept": x["concept"],
                "call_safe": x["call_safe"], "flagged": x["flagged"]})
    return {"id": str(course["id"]), "title": course["title"], "subject": course["subject"],
            "status": course["status"], "units": list(units.values())}


class QuestionPatch(BaseModel):
    prompt: dict[str, Any] | None = None
    options: list[Any] | None = None
    answer: Any = None
    concept: str | None = None
    call_safe: bool | None = None
    flagged: bool | None = None


def _own_question(db: Connection, teacher_id: str, question_id: str) -> None:
    ok = db.execute(text(
        "select exists (select 1 from questions q join lessons l on l.id=q.lesson_id "
        "join units u on u.id=l.unit_id join courses c on c.id=u.course_id "
        "where q.id=:q and c.teacher_id=:t)"), {"q": question_id, "t": teacher_id}).scalar()
    if not ok:
        raise HTTPException(404, "Question not found")


@router.patch("/questions/{question_id}")
def edit_question(question_id: str, body: QuestionPatch, db: DbDep,
                  user: Teacher) -> dict[str, bool]:
    _own_question(db, user.id, question_id)
    data = body.model_dump(exclude_unset=True)
    sets, params = [], {"q": question_id}
    for col, val in data.items():
        if col in ("prompt", "options", "answer"):
            sets.append(f"{col} = cast(:{col} as jsonb)")
            params[col] = json.dumps(val)
        else:
            sets.append(f"{col} = :{col}")
            params[col] = val
    if sets:
        if "flagged" not in data:
            sets.append("flagged = false")      # an edited question counts as reviewed
        db.execute(text(f"update questions set {', '.join(sets)} where id=:q"), params)
    return {"ok": True}


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(question_id: str, db: DbDep, user: Teacher) -> None:
    _own_question(db, user.id, question_id)
    db.execute(text("delete from questions where id=:q"), {"q": question_id})


@router.post("/courses/{course_id}/publish")
def publish(course_id: str, db: DbDep, user: Teacher) -> dict[str, str]:
    own_course(db, user.id, course_id)
    n = db.execute(text("select count(*) from questions q join lessons l on l.id=q.lesson_id "
                        "join units u on u.id=l.unit_id where u.course_id=:c"),
                   {"c": course_id}).scalar_one()
    if n == 0:
        raise HTTPException(409, "Add at least one question before publishing")
    db.execute(text("update courses set status='published' where id=:c"), {"c": course_id})
    return {"status": "published"}


@router.post("/courses/{course_id}/assign")
def assign(course_id: str, body: AssignIn, db: DbDep, user: Teacher) -> dict[str, bool]:
    own_course(db, user.id, course_id)
    own_classroom(db, user.id, body.classroom_id)
    db.execute(text("insert into course_assignments values (:c,:k) on conflict do nothing"),
               {"c": course_id, "k": body.classroom_id})
    return {"ok": True}


# ---------- dashboard ----------
@router.get("/classrooms/{classroom_id}/dashboard")
def dashboard(classroom_id: str, db: DbDep, user: Teacher) -> dict[str, Any]:
    own_classroom(db, user.id, classroom_id)
    now = engine.utcnow()
    klass = db.execute(text("select name, league_enabled, school_consent from classrooms "
                            "where id=:c"), {"c": classroom_id}).mappings().one()
    rows = db.execute(text(
        "select l.id as learner_id, u.name, false as is_call, null as call_status, s.xp, "
        "s.streak, s.last_goal_date, s.freezes, s.last_activity_at "
        "from memberships m join users u on u.id=m.user_id join learners l on l.user_id=u.id "
        "join student_stats s on s.learner_id=l.id where m.classroom_id=:c "
        "union all "
        "select l.id, cs.name, true, cs.status, s.xp, s.streak, s.last_goal_date, s.freezes, "
        "s.last_activity_at from call_students cs join learners l on l.call_student_id=cs.id "
        "join student_stats s on s.learner_id=l.id where cs.classroom_id=:c order by name"),
        {"c": classroom_id}).mappings().all()
    students = []
    for x in rows:
        last = x["last_activity_at"]
        students.append({
            "learner_id": str(x["learner_id"]), "name": x["name"], "is_call": x["is_call"],
            "call_status": x["call_status"], "xp": x["xp"],
            "streak": engine.display_streak(dict(x), now),
            "last_active": last, "idle": last is None or (now - last).days >= 3})
    weak = db.execute(text(
        "select t.concept, round(avg(t.mastery)::numeric, 3) as avg_mastery, count(*) as learners "
        "from twin_concepts t where t.learner_id in (select l.id from learners l "
        "left join memberships m on m.user_id=l.user_id and m.classroom_id=:c "
        "left join call_students cs on cs.id=l.call_student_id and cs.classroom_id=:c "
        "where m.user_id is not null or cs.id is not null) "
        "group by t.concept order by avg(t.mastery) asc limit 5"),
        {"c": classroom_id}).mappings().all()
    return {"name": klass["name"], "league_enabled": klass["league_enabled"],
            "school_consent": klass["school_consent"], "students": students,
            "idle_students": [s["name"] for s in students if s["idle"]],
            "call_only_students": [s["name"] for s in students if s["is_call"]],
            "weak_topics": [{**dict(w), "avg_mastery": float(w["avg_mastery"])} for w in weak]}


# ---------- call-only students (records only; calling arrives in M10) ----------
class CallStudentIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    phone: str
    language: Literal["hi", "kn"]
    call_days: list[int] = [1, 2, 3, 4, 5, 6]
    window_start: time = time(17, 0)
    window_end: time = time(19, 0)
    parent_phone: str | None = None


class CallStudentPatch(BaseModel):
    language: Literal["hi", "kn"] | None = None
    call_days: list[int] | None = None
    window_start: time | None = None
    window_end: time | None = None
    parent_phone: str | None = None
    paused: bool | None = None


def _check_window(start: time, end: time, days: list[int]) -> None:
    if start < time(9, 0) or end > time(21, 0) or start >= end:
        raise HTTPException(422, "Call window must be inside 9 am to 9 pm")
    if not days or any(d < 1 or d > 7 for d in days):
        raise HTTPException(422, "Call days must be numbers 1 (Mon) to 7 (Sun)")


@router.post("/classrooms/{classroom_id}/call-students", status_code=201)
def add_call_student(classroom_id: str, body: CallStudentIn, db: DbDep,
                     user: Teacher) -> dict[str, Any]:
    own_classroom(db, user.id, classroom_id)
    _check_window(body.window_start, body.window_end, body.call_days)
    parent = normalize_phone(body.parent_phone) if body.parent_phone else None
    csid = db.execute(text(
        "insert into call_students(classroom_id, name, phone_e164, language, call_days, "
        "window_start, window_end, parent_phone_e164) values (:c,:n,:p,:l,:d,:ws,:we,:pp) "
        "returning id"),
        {"c": classroom_id, "n": body.name, "p": normalize_phone(body.phone),
         "l": body.language, "d": body.call_days, "ws": body.window_start,
         "we": body.window_end, "pp": parent}).scalar_one()
    lid = create_learner(db, call_student_id=csid)
    db.execute(text("insert into audit_log(actor, action, detail) values (:a,'call_student_added',"
                    "cast(:d as jsonb))"), {"a": user.id, "d": json.dumps({"learner_id": str(lid)})})
    return {"id": str(csid), "learner_id": str(lid), "status": "waiting_consent"}


@router.get("/classrooms/{classroom_id}/call-students")
def list_call_students(classroom_id: str, db: DbDep, user: Teacher) -> list[dict[str, Any]]:
    own_classroom(db, user.id, classroom_id)
    rows = db.execute(text(
        "select id, name, phone_e164, language, call_days, window_start, window_end, status "
        "from call_students where classroom_id=:c order by name"),
        {"c": classroom_id}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


@router.patch("/call-students/{cs_id}")
def edit_call_student(cs_id: str, body: CallStudentPatch, db: DbDep,
                      user: Teacher) -> dict[str, str]:
    row = db.execute(text(
        "select cs.window_start, cs.window_end, cs.call_days, cs.status from call_students cs "
        "join classrooms c on c.id=cs.classroom_id where cs.id=:i and c.teacher_id=:t "
        "for update of cs"), {"i": cs_id, "t": user.id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Student not found")
    ws, we = body.window_start or row["window_start"], body.window_end or row["window_end"]
    days = body.call_days or row["call_days"]
    _check_window(ws, we, days)
    status = row["status"]
    if body.paused is True and status in ("active", "not_reachable"):
        status = "paused"
    elif body.paused is False and status == "paused":
        status = "active"
    db.execute(text("update call_students set window_start=:ws, window_end=:we, call_days=:d, "
                    "language=coalesce(:l, language), "
                    "parent_phone_e164=coalesce(:pp, parent_phone_e164), status=:s where id=:i"),
               {"ws": ws, "we": we, "d": days, "l": body.language, "s": status, "i": cs_id,
                "pp": normalize_phone(body.parent_phone) if body.parent_phone else None})
    return {"status": status}


@router.post("/call-students/{cs_id}/link-code")
def call_student_link_code(cs_id: str, db: DbDep, user: Teacher) -> dict[str, str]:
    lid = db.execute(text(
        "select l.id from learners l join call_students cs on cs.id=l.call_student_id "
        "join classrooms c on c.id=cs.classroom_id where cs.id=:i and c.teacher_id=:t"),
        {"i": cs_id, "t": user.id}).scalar()
    if lid is None:
        raise HTTPException(404, "Student not found")
    return {"code": make_link_code(db, lid)}


def make_link_code(db: Connection, learner_id: Any) -> str:
    code = new_key(8)
    db.execute(text("insert into link_codes(code, learner_id, expires_at) values "
                    "(:c,:l, now() + interval '7 days')"), {"c": code, "l": learner_id})
    return code


@router.post("/me/link-code")
def my_link_code(db: DbDep, user: Student) -> dict[str, str]:
    return {"code": make_link_code(db, learner_id_for(db, user.id))}
