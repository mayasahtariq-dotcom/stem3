"""The /web compatibility layer for apps/web: the web app's contract on top of the real backend."""
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.ai.pipeline import run_pipeline
from app.ai.provider import FakeLLMProvider
from app.main import app
from app.routers.ai import pipeline_runner
from tests.conftest import NoCommit, needs_db
from tests.helpers import make_user, make_world

pytestmark = needs_db


def otp_login(client: TestClient, monkeypatch: pytest.MonkeyPatch, phone: str) -> dict[str, str]:
    from app.auth.sms import FakeSmsProvider, get_sms
    sms = FakeSmsProvider()
    app.dependency_overrides[get_sms] = lambda: sms
    assert client.post("/web/auth/otp", json={"phone": phone}).status_code == 200
    code = sms.last_code("+91" + phone[-10:])
    r = client.post("/web/auth/verify", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_new_phone_is_unregistered_until_onboarding(conn: Connection, client: TestClient,
                                                    monkeypatch: pytest.MonkeyPatch) -> None:
    h = otp_login(client, monkeypatch, "9123400001")
    me = client.get("/web/me", headers=h).json()
    assert me["registered"] is False and me["roles"] == [] and me["language_mode"] is None
    me = client.put("/web/me", headers=h, json={"name": "Asha", "language_mode": "kannada", "roles": ["teacher"]}).json()
    assert me["registered"] is True and me["roles"] == ["teacher"] and me["language_mode"] == "kannada"
    bad = client.post("/web/auth/verify", json={"phone": "9123400001", "code": "000000"})
    assert bad.status_code == 400 and bad.json()["detail"]["code"] in ("INVALID_CODE", "OTP_EXPIRED")


def test_class_key_student_plays_a_lesson_in_web_shapes(conn: Connection, client: TestClient) -> None:
    w = make_world(conn, n_lessons=1)
    key = conn.execute(text("select class_key from classrooms where id=:c"), {"c": w["classroom"]}).scalar_one()
    r = client.post("/web/auth/class-key", json={"class_key": f"{key[:4]}-{key[4:]}", "name": "Riya"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    lid = conn.execute(text("select l.id from learners l join users u on u.id=l.user_id where u.name='Riya' "
                            "order by u.created_at desc limit 1")).scalar_one()
    conn.execute(text("insert into consent_records(learner_id, given_by, granted) values (:l,'school',true)"), {"l": lid})
    home = client.get("/web/me/home", headers=h).json()
    assert home["continue_lesson"]["lesson_id"] == w["lessons"][0] and home["stats"]["hearts"] == 5
    assert set(home["stats"]) >= {"xp_total", "xp_today", "daily_goal", "refill_at", "streak", "longest_streak"}
    path = client.get(f"/web/courses/{w['course']}/path", headers=h).json()
    assert path["units"][0]["lessons"][0]["state"] == "current" and path["subject"] == "BI"
    started = client.post(f"/web/lessons/{w['lessons'][0]}/start", headers=h).json()
    qs = started["lesson"]["questions"]
    assert qs[0]["type"] == "multiple_choice" and "correct_index" not in qs[0]["content"]   # no answers to students
    assert qs[0]["content"]["options"][0]["text"]["en"] == "A"
    for q in qs:
        a = client.post("/web/attempts", headers=h, json={"question_id": q["id"], "answer": {"type": "multiple_choice", "index": 0}}).json()
        assert a["correct"] is True and a["correct_answer"] == {"index": 0} and "stats" in a
    resp = client.post(f"/web/lessons/{w["lessons"][0]}/complete", headers=h)
    assert resp.status_code == 200, resp.text
    done = resp.json()
    assert done["xp_earned"] >= 20 and done["stats"]["xp_total"] > 0


def test_three_language_options_grade_by_index(conn: Connection, client: TestClient) -> None:
    """AI-made courses store options as {en, hi, kn}: picking the right one by index must be marked right."""
    import json
    w = make_world(conn, n_lessons=1)
    opts = [{"en": "Systematic study of nature", "hi": "प्रकृति का अध्ययन", "kn": "ಪ್ರಕೃತಿ"},
            {"en": "Art of painting", "hi": "चित्रकला", "kn": "ಚಿತ್ರಕಲೆ"}]
    qid = conn.execute(text("select id from questions where lesson_id=:l and kind='mcq' order by position limit 1"),
                       {"l": w["lessons"][0]}).scalar_one()
    conn.execute(text("update questions set options=cast(:o as jsonb), answer=cast(:a as jsonb) where id=:q"),
                 {"o": json.dumps(opts, ensure_ascii=False), "a": json.dumps(opts[0], ensure_ascii=False), "q": qid})
    h = w["student"]["headers"]
    client.post(f"/web/lessons/{w['lessons'][0]}/start", headers=h)
    # the web app sends the bare answer, without "type" (that's what the real browser posts)
    r = client.post("/web/attempts", headers=h, json={"question_id": str(qid), "answer": {"index": 0}})
    assert r.status_code == 200, r.text
    assert r.json()["correct"] is True and r.json()["correct_answer"] == {"index": 0}
    tf = conn.execute(text("select id from questions where lesson_id=:l and kind='true_false' limit 1"),
                      {"l": w["lessons"][0]}).scalar()
    if tf:
        ans = conn.execute(text("select answer from questions where id=:q"), {"q": tf}).scalar_one()
        r = client.post("/web/attempts", headers=h, json={"question_id": str(tf), "answer": {"value": ans in (True, "true")}})
        assert r.json()["correct"] is True


def test_teacher_screens_and_join_key_format(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h = w["teacher"]["headers"]
    created = client.post("/web/classrooms", headers=h, json={"name": "9B", "subject": "PH", "grade": 9}).json()
    assert created["subject"] == "PH" and created["grade"] == 9
    import re
    assert re.fullmatch(r"PH09-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}", created["join_key"])
    dash = client.get(f"/web/classrooms/{w['classroom']}/dashboard", headers=h).json()
    assert dash["tiles"]["student_count"] == 1 and dash["students"][0]["name"] == "Ravi"
    assert client.get("/web/teacher/overview", headers=h).json()["class_count"] == 2
    course = client.get(f"/web/courses/{w['course']}", headers=h).json()
    lesson = client.get(f"/web/lessons/{course['units'][0]['lessons'][0]['id']}", headers=h).json()
    assert "correct_index" in lesson["questions"][0]["content"]                       # teachers see answers
    assert client.get(f"/web/classrooms/{w['classroom']}/dashboard", headers=w["student"]["headers"]).status_code == 403


def test_game_endpoints(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h = w["student"]["headers"]
    stats = client.get("/web/game/stats", headers=h).json()
    assert stats["freeze_cost"] == 100 and stats["mascot"]["stage"] == "calf"
    shop = client.get("/web/game/shop", headers=h).json()
    assert {s["id"] for s in shop} >= {"cap", "bow"} and all(s["price"] == 30 for s in shop)
    quests = client.get("/web/game/quests", headers=h).json()
    assert {q["kind"] for q in quests} <= {"answer_questions", "combo", "finish_lessons", "perfect_lesson", "earn_xp"}
    assert client.get("/web/game/league", headers=h).json()["promote_count"] == 3
    assert len(client.get("/web/game/badges", headers=h).json()) >= 40
    assert client.post("/web/game/shop/cap/buy", headers=h).status_code == 409                 # no gems yet


def test_parent_flow(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    code = client.post("/web/me/link-code", headers=w["student"]["headers"]).json()["code"]
    p = make_user(conn, "parent")
    preview = client.get(f"/web/parent/link/{code}", headers=p["headers"]).json()
    assert preview["name"] == "Ravi"
    child = client.post("/web/parent/link", headers=p["headers"], json={"code": code}).json()
    assert child["consent_status"] == "approved"                     # school consent in make_world
    child = client.post(f"/web/parent/children/{child['id']}/revoke-consent", headers=p["headers"]).json()
    assert child["consent_status"] == "revoked"
    dash = client.get(f"/web/parent/children/{child['id']}/dashboard", headers=p["headers"]).json()
    assert dash["week"]["arrow"] in ("up", "down", "same") and dash["child"]["name"] == "Ravi"


def test_upload_pages_then_start_makes_a_course(conn: Connection, client: TestClient) -> None:
    app.dependency_overrides[pipeline_runner] = lambda: (
        lambda uid: run_pipeline(NoCommit(conn), FakeLLMProvider(), uid))  # type: ignore[arg-type]
    try:
        t = make_user(conn, "teacher")
        h = t["headers"]
        up = client.post("/web/uploads", headers=h, json={"pages": [{"kind": "photo"}, {"kind": "text", "text": "Cells are tiny."}]}).json()
        assert f"/web/uploads/{up['id']}/pages/0?exp=" in up["pages"][0]["upload_url"] and up["pages"][1]["upload_url"] is None
        assert client.get(f"/web/uploads/{up['id']}", headers=h).json()["status"] == "created"
        path = up["pages"][0]["upload_url"].split("testserver")[-1]
        bad = path.split("&sig=")[0] + "&sig=bad"
        assert client.put(bad, headers={"Content-Type": "image/png"}, content=b"x").status_code == 403
        # signed link: no bearer token, like a storage URL; "try this page again" replaces the page
        assert client.put(path, headers={"Content-Type": "image/png"}, content=b"fake-png").status_code == 204
        assert client.put(path, headers={"Content-Type": "image/png"}, content=b"fake-png-2").status_code == 204
        client.post(f"/web/uploads/{up['id']}/start", headers=h)
        st: dict[str, Any] = client.get(f"/web/uploads/{up['id']}", headers=h).json()
        assert st["status"] == "ready" and st["course_id"] and st["first_lesson_id"] and st["page_count"] == 2
    finally:
        app.dependency_overrides.pop(pipeline_runner, None)


def test_class_notes_teacher_shares_students_read(conn: Connection, client: TestClient) -> None:
    import base64
    w = make_world(conn)
    th, sh = w["teacher"]["headers"], w["student"]["headers"]
    url = f"/web/classrooms/{w['classroom']}/notes"
    assert client.post(url, headers=th, json={"title": "Empty"}).status_code == 422          # needs text or a file
    assert client.post(url, headers=sh, json={"title": "x", "body": "y"}).status_code == 403  # students can't post
    data_url = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 cells").decode()
    n = client.post(url, headers=th, json={"title": "Cells", "body": "Cells are tiny.",
                                           "file": {"name": "cells.pdf", "type": "application/pdf", "data_url": data_url}})
    assert n.status_code == 201, n.text
    note = n.json()
    assert note["file"]["size"] == len(b"%PDF-1.4 cells") and note["classroom_id"] == w["classroom"]
    mine = client.get("/web/me/notes", headers=sh).json()
    assert [x["title"] for x in mine] == ["Cells"] and mine[0]["body"] == "Cells are tiny."
    f = client.get(mine[0]["file"]["url"].split("testserver")[-1])                         # signed: no token needed
    assert f.status_code == 200 and f.content == b"%PDF-1.4 cells" and f.headers["content-type"] == "application/pdf"
    assert client.get(f"/web/notes/{note['id']}/file?exp=9999999999&sig=bad").status_code == 403
    outsider = make_user(conn, "student")
    assert client.get("/web/me/notes", headers=outsider["headers"]).json() == []
    assert len(client.get("/web/teacher/notes", headers=th).json()) == 1
    assert client.delete(f"/web/notes/{note['id']}", headers=th).status_code == 204
    assert client.get("/web/me/notes", headers=sh).json() == []


def test_upload_to_a_class_then_publish_assigns_it_and_shares_the_notes(conn: Connection, client: TestClient) -> None:
    app.dependency_overrides[pipeline_runner] = lambda: (
        lambda uid: run_pipeline(NoCommit(conn), FakeLLMProvider(), uid))  # type: ignore[arg-type]
    try:
        w = make_world(conn)
        th, sh = w["teacher"]["headers"], w["student"]["headers"]
        up = client.post("/web/uploads", headers=th, json={"classroom_id": w["classroom"], "pages": [
            {"kind": "photo"}, {"kind": "text", "text": "Plants make food from sunlight."}]}).json()
        path = up["pages"][0]["upload_url"].split("testserver")[-1]
        assert client.put(path, headers={"Content-Type": "image/png"}, content=b"fake-png").status_code == 204
        client.post(f"/web/uploads/{up['id']}/start", headers=th)
        st = client.get(f"/web/uploads/{up['id']}", headers=th).json()
        assert st["status"] == "ready"
        # publish without naming a class: the class picked at upload gets it
        r = client.post(f"/web/lessons/{st['first_lesson_id']}/publish", headers=th, json={"classroom_id": None})
        assert r.status_code == 200, r.text
        course = client.get(f"/web/courses/{st['course_id']}", headers=th).json()
        assert w["classroom"] in course["assigned_classroom_ids"]
        notes = client.get("/web/me/notes", headers=sh).json()
        assert len(notes) == 2                                         # one per uploaded page
        assert {n["file"]["type"] if n["file"] else n["body"] for n in notes} == {"image/png", "Plants make food from sunlight."}
        client.post(f"/web/lessons/{st['first_lesson_id']}/publish", headers=th, json={"classroom_id": None})
        assert len(client.get("/web/me/notes", headers=sh).json()) == 2   # re-publish doesn't duplicate
    finally:
        app.dependency_overrides.pop(pipeline_runner, None)


def test_call_console(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h = w["teacher"]["headers"]
    cs = client.post(f"/web/classrooms/{w['classroom']}/call-students", headers=h, json={
        "name": "Ananya", "parent_phone": "+919876500001", "language": "hindi",
        "window": {"start": "17:00", "end": "19:00"}, "days": [1, 2, 3]}).json()
    assert cs["status"] == "waiting_consent" and cs["phone_last4"] == "0001" and cs["window"] == {"start": "17:00", "end": "19:00"}
    listed = client.get(f"/web/classrooms/{w['classroom']}/call-students", headers=h).json()
    assert listed[0]["weekly_cap_minutes"] == 15
    paused = client.patch(f"/web/call-students/{cs['id']}", headers=h, json={"paused": True}).json()
    assert paused["status"] == "waiting_consent"                     # can't pause before consent; unchanged
    twin = client.get(f"/web/call-students/{cs['id']}/twin", headers=h).json()
    assert twin["lessons_heard"] == 0 and "summary" in twin
    bad = client.post(f"/web/classrooms/{w['classroom']}/call-students", headers=h, json={
        "name": "X", "parent_phone": "+919876500002", "language": "hindi", "window": {"start": "08:00", "end": "10:00"}, "days": [1]})
    assert bad.status_code == 422
