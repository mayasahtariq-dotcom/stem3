"""Call mode with the fake phone provider: language menu, consent, keypad lesson with a
confirm step, incoming calls (caller ID), guards and webhook signatures."""
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.calls import flow
from app.calls.provider import FakeTelephonyProvider
from app.calls.twilio import signature
from app.config import Settings
from app.main import app
from app.routers.calls import telephony
from tests.conftest import needs_db
from tests.helpers import make_call_safe, make_world

pytestmark = needs_db


@pytest.fixture
def phone(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeTelephonyProvider]:
    fake = FakeTelephonyProvider()
    test_settings = Settings(call_hours_enforced=False, twilio_auth_token="",
                             use_fake_telephony=True, public_base_url="")
    monkeypatch.setattr("app.calls.flow.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.routers.calls.get_settings", lambda: test_settings)
    app.dependency_overrides[telephony] = lambda: fake
    yield fake
    app.dependency_overrides.pop(telephony, None)


def setup_call_student(conn: Connection, client: TestClient) -> dict[str, Any]:
    w = make_world(conn)
    make_call_safe(conn, w["course"])
    r = client.post(f"/v1/classrooms/{w['classroom']}/call-students", headers=w["teacher"]["headers"],
                    json={"name": "Ananya K", "phone": "9876500001", "language": "hi",
                          "parent_phone": "9876500002"})
    return {**w, "cs": r.json()["id"], "cs_learner": r.json()["learner_id"]}


def consent_for(conn: Connection, cs: str, learner: str) -> None:
    conn.execute(text("update call_students set status='active' where id=:i"), {"i": cs})
    conn.execute(text("insert into consent_records(learner_id, given_by, granted) values "
                      "(:l,'parent_keypress',true)"), {"l": learner})


def hook(client: TestClient, path: str, sid: str, digits: str | None = None) -> str:
    data = {"CallSid": "CA1"} | ({"Digits": digits} if digits is not None else {})
    r = client.post(f"/v1/webhooks/twilio/{path}?s={sid}", data=data)
    assert r.status_code == 200, r.text
    return str(r.text)


def pick_and_confirm(client: TestClient, sid: str, digit: str = "1") -> str:
    chosen = hook(client, "answer", sid, digit)
    assert "/confirm?s=" in chosen                       # "You chose X. Press 1 to confirm"
    return hook(client, "confirm", sid, "1")


def ring(client: TestClient, from_number: str, call_sid: str = "CAin") -> str:
    r = client.post("/v1/webhooks/twilio/incoming", data={"From": from_number, "CallSid": call_sid})
    assert r.status_code == 200, r.text
    return str(r.text)


def session_for(conn: Connection, call_sid: str) -> str:
    return str(conn.execute(text("select id from call_sessions where provider_call_id=:c"),
                            {"c": call_sid}).scalar_one())


def test_consent_call_then_keypad_lesson(conn: Connection, client: TestClient,
                                         phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    th = w["teacher"]["headers"]
    started = client.post(f"/v1/call-students/{w['cs']}/call-now", headers=th).json()
    assert started["kind"] == "consent" and phone.calls[0][0] == "+919876500002"   # parent first
    sid = started["session_id"]

    menu = hook(client, "voice", sid)
    assert "/lang?s=" in menu and "हिंदी" in menu and "ಕನ್ನಡ" in menu and "English" in menu
    first = hook(client, "lang", sid, "1")
    assert "/consent?s=" in first and "1 दबाएँ" in first
    lesson = hook(client, "consent", sid, "1")
    assert "धन्यवाद" in lesson and "गोलू" in lesson and "/answer?s=" in lesson
    assert "4 दबाओ, सवाल दोबारा" in lesson                  # 3 options, then 4 = repeat
    status = client.get(f"/v1/classrooms/{w['classroom']}/call-students", headers=th).json()
    assert status[0]["status"] == "active"

    out = ""
    for _ in range(3):                                    # option 1 is the right answer ("A")
        out = pick_and_confirm(client, sid)
    assert "<Hangup/>" in out and "अलविदा" in out
    xp, n = conn.execute(text(
        "select s.xp, (select count(*) from answer_attempts a where a.learner_id=s.learner_id "
        "and a.channel='call') from student_stats s where s.learner_id=:l"),
        {"l": w["cs_learner"]}).one()
    assert n == 3 and xp == 10 + 10 + 12 + 20           # combo bonus + lesson completed
    card = client.get(f"/v1/call-students/{w['cs']}/twin", headers=th).json()
    assert card["recent_calls"] and card["next_lesson"] == "L2"


def test_confirm_change_repeat_skip_and_silence(conn: Connection, client: TestClient,
                                                phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    consent_for(conn, w["cs"], w["cs_learner"])
    sid = client.post(f"/v1/call-students/{w['cs']}/call-now",
                      headers=w["teacher"]["headers"]).json()["session_id"]
    assert phone.calls[0][0] == "+919876500001"           # lesson calls go to the student
    hook(client, "voice", sid)
    assert "गोलू" in hook(client, "lang", sid, "1")
    hook(client, "answer", sid, "2")
    assert "/answer?s=" in hook(client, "confirm", sid, "2")    # changed mind: question again
    assert conn.execute(text("select count(*) from answer_attempts where learner_id=:l"),
                        {"l": w["cs_learner"]}).scalar_one() == 0   # nothing counted yet
    assert "लगभग" in pick_and_confirm(client, sid, "2")      # "not quite", never "wrong"
    assert "/answer?s=" in hook(client, "answer", sid, "4")  # 4 = repeat the question
    hook(client, "answer", sid, "#")                          # skip
    for _ in range(3):                                        # silence three times ends it
        last = hook(client, "voice", sid)
    assert "<Hangup/>" in last


def test_english_call(conn: Connection, client: TestClient,
                      phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    consent_for(conn, w["cs"], w["cs_learner"])
    sid = client.post(f"/v1/call-students/{w['cs']}/call-now",
                      headers=w["teacher"]["headers"]).json()["session_id"]
    hook(client, "voice", sid)
    greet = hook(client, "lang", sid, "3")
    assert "I am Golu" in greet and "Press 4 to hear the question again" in greet
    assert 'language="en-IN"' in greet
    assert "Press 1 to confirm" in hook(client, "answer", sid, "1")


def test_decline_and_consent_guards(conn: Connection, client: TestClient,
                                    phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    th = w["teacher"]["headers"]
    sid = client.post(f"/v1/call-students/{w['cs']}/call-now", headers=th).json()["session_id"]
    hook(client, "voice", sid)
    hook(client, "lang", sid, "2")                           # Kannada
    assert "<Hangup/>" in hook(client, "consent", sid, "2")
    assert client.post(f"/v1/call-students/{w['cs']}/call-now", headers=th).status_code == 409

    other = setup_call_student(conn, client)                # active but no consent record
    conn.execute(text("update call_students set status='active' where id=:i"), {"i": other["cs"]})
    r = client.post(f"/v1/call-students/{other['cs']}/call-now", headers=other["teacher"]["headers"])
    assert r.status_code == 409 and "never called" in r.json()["detail"]


def test_weekly_cap(conn: Connection, client: TestClient, phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    conn.execute(text("insert into call_sessions(call_student_id, scheduled_for, status, "
                      "seconds_used) values (:c, now(), 'completed', 900)"), {"c": w["cs"]})
    r = client.post(f"/v1/call-students/{w['cs']}/call-now", headers=w["teacher"]["headers"])
    assert r.status_code == 409 and phone.calls == []


def test_webhook_signature_is_checked(conn: Connection, client: TestClient,
                                      phone: FakeTelephonyProvider,
                                      monkeypatch: pytest.MonkeyPatch) -> None:
    w = setup_call_student(conn, client)
    sid = client.post(f"/v1/call-students/{w['cs']}/call-now",
                      headers=w["teacher"]["headers"]).json()["session_id"]
    secure = Settings(twilio_auth_token="tok", public_base_url="https://aaroh.test",
                      use_fake_telephony=False, call_hours_enforced=False)
    monkeypatch.setattr("app.routers.calls.get_settings", lambda: secure)
    monkeypatch.setattr("app.calls.flow.get_settings", lambda: secure)
    path = f"/v1/webhooks/twilio/voice?s={sid}"
    assert client.post(path, data={"CallSid": "CA1"}).status_code == 403
    good = signature("tok", "https://aaroh.test" + path, {"CallSid": "CA1"})
    r = client.post(path, data={"CallSid": "CA1"}, headers={"X-Twilio-Signature": good})
    assert r.status_code == 200 and "https://aaroh.test/v1/webhooks/twilio/lang" in r.text


def test_call_hours() -> None:
    assert flow.within_call_hours(datetime(2026, 3, 2, 12, 0, tzinfo=UTC))       # 17:30 IST
    assert not flow.within_call_hours(datetime(2026, 3, 2, 16, 0, tzinfo=UTC))   # 21:30 IST


# ---------- incoming calls: the student rings us ----------
def test_incoming_call_matches_student_and_twin_picks_lesson(
    conn: Connection, client: TestClient, phone: FakeTelephonyProvider
) -> None:
    w = setup_call_student(conn, client)
    consent_for(conn, w["cs"], w["cs_learner"])
    assert "/lang?s=" in ring(client, "+919876500001")       # language menu first
    sid = session_for(conn, "CAin")
    out = hook(client, "lang", sid, "1")
    assert "Ananya" in out and "L1" in out and "/answer?s=" in out   # twin chose the lesson
    for _ in range(3):
        last = pick_and_confirm(client, sid)
    assert "<Hangup/>" in last
    client.post("/v1/webhooks/twilio/status",
                data={"CallSid": "CAin", "CallStatus": "completed", "CallDuration": "95"})
    assert conn.execute(text("select seconds_used from call_sessions where id=:s"),
                        {"s": sid}).scalar_one() == 95


def test_unknown_caller_gets_no_learner_data(conn: Connection, client: TestClient,
                                              phone: FakeTelephonyProvider) -> None:
    setup_call_student(conn, client)
    out = ring(client, "+919999911111")
    assert "not registered" in out and "Ananya" not in out and "<Hangup/>" in out


def test_siblings_pick_with_a_key(conn: Connection, client: TestClient,
                                  phone: FakeTelephonyProvider) -> None:
    w = setup_call_student(conn, client)
    consent_for(conn, w["cs"], w["cs_learner"])
    ravi = client.post(f"/v1/classrooms/{w['classroom']}/call-students",
                       headers=w["teacher"]["headers"],
                       json={"name": "Ravi K", "phone": "9876500001", "language": "hi"}).json()
    consent_for(conn, ravi["id"], ravi["learner_id"])
    out = ring(client, "+919876500001", "CAsib")
    assert "Ananya" in out and "Ravi" in out and "/pick?s=" in out
    sid = session_for(conn, "CAsib")
    assert "/lang?s=" in hook(client, "pick", sid, "2")
    chosen = hook(client, "lang", sid, "1")
    assert "Ravi" in chosen and "/answer?s=" in chosen
    assert str(conn.execute(text("select learner_id from call_sessions where id=:s"),
                            {"s": sid}).scalar_one()) == ravi["learner_id"]


def test_incoming_without_consent_asks_consent_first(conn: Connection, client: TestClient,
                                                      phone: FakeTelephonyProvider) -> None:
    setup_call_student(conn, client)
    ring(client, "+919876500001")
    out = hook(client, "lang", session_for(conn, "CAin"), "1")
    assert "/consent?s=" in out and "/answer?s=" not in out
