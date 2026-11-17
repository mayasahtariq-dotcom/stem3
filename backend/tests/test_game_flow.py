"""M4/M5 end to end on the real database (rolled back). Time is passed in for control."""
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.game import engine
from tests.conftest import needs_db
from tests.helpers import make_world

pytestmark = needs_db
T0 = datetime(2026, 3, 4, 10, 0, tzinfo=UTC)      # 15:30 IST


def sec(n: float) -> datetime:
    return T0 + timedelta(seconds=n)


def test_full_lesson_flow(conn: Connection) -> None:
    w = make_world(conn)
    uid, lesson = w["student"]["id"], w["lessons"][0]
    qs = engine.start_lesson(conn, uid, lesson, sec(0))
    assert len(qs) == 3 and all("answer" not in q for q in qs)
    q0, q1, q2 = w["questions"][lesson]

    r1 = engine.record_attempt(conn, uid, q0, "B", sec(2))            # wrong
    assert (r1["correct"], r1["xp_gained"], r1["hearts"], r1["feedback"]) == (
        False, 0, 4, "not_quite")
    r2 = engine.record_attempt(conn, uid, q0, "A", sec(4))            # retry
    assert (r2["correct"], r2["first_try"], r2["xp_gained"]) == (True, False, 5)
    r3 = engine.record_attempt(conn, uid, q1, "A", sec(6))
    assert r3["xp_gained"] == 10
    r4 = engine.record_attempt(conn, uid, q2, "A", sec(8))            # third in a row: +2 combo
    assert (r4["xp_gained"], r4["combo"]) == (12, 3)

    done = engine.complete_lesson(conn, uid, lesson, sec(10))
    assert done["xp_gained"] == 20 and not done["perfect"] and done["gems_gained"] == 5
    assert done["stats"]["xp"] == 47 and done["stats"]["streak"] == 1    # goal of 20 met
    assert done["stats"]["gems"] >= 5
    with pytest.raises(HTTPException) as e:                              # no double rewards
        engine.complete_lesson(conn, uid, lesson, sec(11))
    assert e.value.status_code == 409
    mastery = conn.execute(text("select mastery from twin_concepts where learner_id=:l"),
                           {"l": w["student"]["learner"]}).scalar_one()
    assert mastery > 0


def test_lessons_unlock_in_order(conn: Connection) -> None:
    w = make_world(conn)
    uid = w["student"]["id"]
    with pytest.raises(HTTPException) as e:
        engine.start_lesson(conn, uid, w["lessons"][1], sec(0))
    assert e.value.status_code == 409


def test_needs_consent_hearts_and_fast_answers(conn: Connection) -> None:
    w = make_world(conn)
    uid, lesson, lid = w["student"]["id"], w["lessons"][0], w["student"]["learner"]
    q0, q1, _ = w["questions"][lesson]
    engine.start_lesson(conn, uid, lesson, sec(0))
    fast1 = engine.record_attempt(conn, uid, q0, "A", sec(5))
    fast2 = engine.record_attempt(conn, uid, q1, "A", sec(5.3))          # 0.3 s later: not human
    assert fast1["xp_gained"] == 10 and fast2["suspicious"] and fast2["xp_gained"] == 0

    conn.execute(text("update student_stats set hearts=0 where learner_id=:l"), {"l": lid})
    with pytest.raises(HTTPException) as e:
        engine.record_attempt(conn, uid, q1, "A", sec(6))
    assert e.value.status_code == 409

    conn.execute(text("delete from consent_records where learner_id=:l"), {"l": lid})
    with pytest.raises(HTTPException) as e2:
        engine.start_lesson(conn, uid, lesson, sec(7))
    assert e2.value.status_code == 403


def test_students_cannot_open_other_classes_or_teacher_routes(
    conn: Connection, client: TestClient
) -> None:
    w = make_world(conn)
    assert client.get("/v1/home").status_code == 401
    other = make_world(conn)
    r = client.post(f"/v1/lessons/{other['lessons'][0]}/start", headers=w["student"]["headers"])
    assert r.status_code == 404
    r = client.post(f"/v1/lessons/{w['lessons'][0]}/start", headers=w["teacher"]["headers"])
    assert r.status_code == 403


def test_http_flow_path_home_stats(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h = w["student"]["headers"]
    home = client.get("/v1/home", headers=h).json()
    assert home["continue"]["lesson_id"] == w["lessons"][0]
    path = client.get(f"/v1/courses/{w['course']}/path", headers=h).json()
    assert [le["state"] for le in path["units"][0]["lessons"]] == ["current", "locked"]
    qs = client.post(f"/v1/lessons/{w['lessons'][0]}/start", headers=h).json()["questions"]
    assert len(qs) == 3
    a = client.post("/v1/attempts", headers=h, json={"question_id": qs[0]["id"], "answer": "A"})
    assert a.status_code == 200 and a.json()["correct"] is True
    st = client.get("/v1/game/stats", headers=h).json()
    assert st["xp"] == 10 and st["hearts"] == 5
    assert client.post("/v1/game/freeze", headers=h).status_code == 409    # no gems yet
