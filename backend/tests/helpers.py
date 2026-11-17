"""Builders for test data (inserted directly; always rolled back)."""
import json
import uuid
from typing import Any

from sqlalchemy import Connection, text

from app.auth.tokens import issue_token
from app.people import create_learner


def make_user(db: Connection, role: str, name: str = "User") -> dict[str, Any]:
    uid = db.execute(text("insert into users(role, name, phone_e164) values (:r,:n,:p) "
                          "returning id"),
                     {"r": role, "n": name, "p": "+9197" + str(uuid.uuid4().int)[:8]}).scalar_one()
    lid = create_learner(db, user_id=uid) if role == "student" else None
    return {"id": str(uid), "learner": lid, "headers":
            {"Authorization": f"Bearer {issue_token(uid, role)}"}}


def make_world(db: Connection, n_questions: int = 3, n_lessons: int = 2) -> dict[str, Any]:
    """Teacher, class, published course (units > lessons > questions), one consenting student."""
    teacher = make_user(db, "teacher", "Teacher")
    cid = db.execute(text("insert into classrooms(teacher_id, name, class_key) values "
                          "(:t,'8A',:k) returning id"),
                     {"t": teacher["id"], "k": uuid.uuid4().hex[:8].upper()}).scalar_one()
    course = db.execute(text("insert into courses(teacher_id, title, subject, status) values "
                             "(:t,'Cells','biology','published') returning id"),
                        {"t": teacher["id"]}).scalar_one()
    unit = db.execute(text("insert into units(course_id, position, title) values (:c,1,'U1') "
                           "returning id"), {"c": course}).scalar_one()
    lessons, questions = [], {}
    for i in range(n_lessons):
        le = db.execute(text("insert into lessons(unit_id, position, title) values (:u,:p,:t) "
                             "returning id"), {"u": unit, "p": i + 1, "t": f"L{i + 1}"}).scalar_one()
        lessons.append(str(le))
        qs = []
        for j in range(n_questions):
            qid = db.execute(text(
                "insert into questions(lesson_id, kind, prompt, options, answer, concept) values "
                "(:l,'mcq',cast(:p as jsonb),cast(:o as jsonb),cast(:a as jsonb),:c) returning id"),
                {"l": le, "p": json.dumps({"regional": "?", "english": f"Q{j}"}),
                 "o": json.dumps(["A", "B", "C"]), "a": json.dumps("A"),
                 "c": f"concept{i}"}).scalar_one()
            qs.append(str(qid))
        questions[str(le)] = qs
    db.execute(text("insert into course_assignments values (:c,:k)"), {"c": course, "k": cid})
    student = make_user(db, "student", "Ravi")
    db.execute(text("insert into memberships values (:c,:u)"), {"c": cid, "u": student["id"]})
    db.execute(text("insert into consent_records(learner_id, given_by, granted) values "
                    "(:l,'school',true)"), {"l": student["learner"]})
    return {"teacher": teacher, "student": student, "classroom": str(cid), "course": str(course),
            "lessons": lessons, "questions": questions}


def make_call_safe(db: Connection, course_id: str) -> None:
    """Mark only this course's questions phone-safe (never touch other tests' rows)."""
    db.execute(text("update questions set call_safe=true where lesson_id in (select l.id from lessons l "
                    "join units u on u.id=l.unit_id where u.course_id=:c)"), {"c": course_id})
