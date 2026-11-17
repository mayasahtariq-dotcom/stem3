"""RLS tests against a real Postgres (DATABASE_URL). Everything runs in a rolled-back transaction."""
import uuid
from collections.abc import Iterator

import psycopg
import pytest

from app.config import get_settings

URL = get_settings().database_url.replace("+psycopg", "")
pytestmark = pytest.mark.skipif(not URL, reason="DATABASE_URL not set")


def uid() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def db() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(URL)
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def act_as(conn: psycopg.Connection, user: str | None) -> None:
    conn.execute("reset role")
    if user:
        conn.execute("select set_config('request.jwt.claim.sub', %s, true)", (user,))
        conn.execute("set local role authenticated")


def count(conn: psycopg.Connection, user: str, sql: str, *args: object) -> int:
    act_as(conn, user)
    n = conn.execute(f"select count(*) from ({sql}) q", args).fetchone()[0]  # type: ignore[index]
    act_as(conn, None)
    return int(n)


@pytest.fixture
def world(db: psycopg.Connection) -> dict[str, str]:
    w = {k: uid() for k in
         ["t1", "t2", "s1", "s2", "p1", "p2", "c1", "c2", "l_s1", "l_s2", "cs", "l_cs", "course"]}
    for key, role in [("t1", "teacher"), ("t2", "teacher"), ("s1", "student"),
                      ("s2", "student"), ("p1", "parent"), ("p2", "parent")]:
        db.execute("insert into users(id, role, name) values (%s,%s,%s)", (w[key], role, key))
    db.execute("insert into classrooms(id, teacher_id, name, class_key) values (%s,%s,'A',%s)",
               (w["c1"], w["t1"], uid()))
    db.execute("insert into classrooms(id, teacher_id, name, class_key) values (%s,%s,'B',%s)",
               (w["c2"], w["t2"], uid()))
    db.execute("insert into memberships values (%s,%s)", (w["c1"], w["s1"]))
    db.execute("insert into memberships values (%s,%s)", (w["c2"], w["s2"]))
    db.execute("insert into learners(id, kind, user_id) values (%s,'app',%s)", (w["l_s1"], w["s1"]))
    db.execute("insert into learners(id, kind, user_id) values (%s,'app',%s)", (w["l_s2"], w["s2"]))
    db.execute("insert into call_students(id, classroom_id, name, phone_e164, language) "
               "values (%s,%s,'Call Kid','+919999999999','hi')", (w["cs"], w["c1"]))
    db.execute("insert into learners(id, kind, call_student_id) values (%s,'call',%s)",
               (w["l_cs"], w["cs"]))
    db.execute("insert into parent_links values (%s,%s)", (w["p1"], w["l_s1"]))
    for key in ("l_s1", "l_s2", "l_cs"):
        db.execute("insert into student_stats(learner_id, xp) values (%s, 50)", (w[key],))
        db.execute("insert into doubts(learner_id, text) values (%s,'secret doubt')", (w[key],))
    db.execute("insert into courses(id, teacher_id, title, subject) values (%s,%s,'C','biology')",
               (w["course"], w["t1"]))
    return w


STATS = "select * from student_stats"


def test_student_sees_only_own_stats(db: psycopg.Connection, world: dict[str, str]) -> None:
    assert count(db, world["s1"], STATS) == 1
    assert count(db, world["s2"], STATS) == 1


def test_teacher_sees_only_own_class_including_call_student(
    db: psycopg.Connection, world: dict[str, str]
) -> None:
    assert count(db, world["t1"], STATS) == 2   # s1 + call-only student
    assert count(db, world["t2"], STATS) == 1   # s2 only


def test_parent_sees_only_linked_child(db: psycopg.Connection, world: dict[str, str]) -> None:
    assert count(db, world["p1"], STATS) == 1
    assert count(db, world["p2"], STATS) == 0


def test_doubts_visible_only_to_the_student(db: psycopg.Connection, world: dict[str, str]) -> None:
    sql = "select * from doubts"
    assert count(db, world["s1"], sql) == 1
    assert count(db, world["t1"], sql) == 0
    assert count(db, world["p1"], sql) == 0


def test_unpublished_course_hidden_from_students(
    db: psycopg.Connection, world: dict[str, str]
) -> None:
    db.execute("insert into course_assignments values (%s,%s)", (world["course"], world["c1"]))
    sql = "select * from courses"
    assert count(db, world["s1"], sql) == 0
    db.execute("update courses set status='published' where id=%s", (world["course"],))
    assert count(db, world["s1"], sql) == 1
    assert count(db, world["s2"], sql) == 0   # other class
    assert count(db, world["t2"], sql) == 0


def test_call_students_only_for_their_teacher(
    db: psycopg.Connection, world: dict[str, str]
) -> None:
    sql = "select * from call_students"
    assert count(db, world["t1"], sql) == 1
    assert count(db, world["t2"], sql) == 0
    assert count(db, world["s1"], sql) == 0


def test_clients_cannot_write(db: psycopg.Connection, world: dict[str, str]) -> None:
    act_as(db, world["s1"])
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("update student_stats set xp = 9999")


def test_gems_ledger_is_append_only(db: psycopg.Connection, world: dict[str, str]) -> None:
    db.execute("insert into gems_ledger(learner_id, delta, reason) values (%s, 5, 'lesson')",
               (world["l_s1"],))
    with pytest.raises(psycopg.errors.RaiseException):
        db.execute("update gems_ledger set delta = 500")


def test_deleting_learner_removes_their_rows(db: psycopg.Connection, world: dict[str, str]) -> None:
    db.execute("delete from learners where id=%s", (world["l_s1"],))
    n = db.execute("select count(*) from student_stats where learner_id=%s",
                   (world["l_s1"],)).fetchone()[0]  # type: ignore[index]
    assert n == 0
