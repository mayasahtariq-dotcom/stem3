"""Parent SMS when a student finishes a whole course (web and call)."""
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.auth.sms import FakeSmsProvider
from app.calls.provider import FakeTelephonyProvider
from app.config import Settings
from app.game import engine
from app.main import app
from app.routers.calls import telephony
from tests.conftest import needs_db
from tests.helpers import make_user, make_world

pytestmark = needs_db
DAY = datetime(2026, 3, 4, 10, 0, tzinfo=UTC)       # 15:30 IST
NIGHT = datetime(2026, 3, 4, 16, 30, tzinfo=UTC)    # 22:00 IST


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeSmsProvider]:
    fake = FakeSmsProvider()
    monkeypatch.setattr("app.notify.sms_sender", lambda: fake)
    monkeypatch.setattr("app.notify.get_settings", lambda: Settings(quiet_hours_enforced=True))
    yield fake


def link_parent(conn: Connection, lid: Any) -> str:
    p = make_user(conn, "parent", "Mum")
    conn.execute(text("insert into parent_links values (:p,:l)"), {"p": p["id"], "l": lid})
    return str(conn.execute(text("select phone_e164 from users where id=:u"),
                            {"u": p["id"]}).scalar_one())


def finish(conn: Connection, w: dict[str, Any], lesson: str, at: datetime) -> dict[str, Any]:
    uid = w["student"]["id"]
    engine.start_lesson(conn, uid, lesson, at)
    for i, q in enumerate(w["questions"][lesson]):
        engine.record_attempt(conn, uid, q, "A", at + timedelta(seconds=2 * (i + 1)))
    return engine.complete_lesson(conn, uid, lesson, at + timedelta(seconds=20))


def test_parent_texted_once_when_course_finished(conn: Connection, sms: FakeSmsProvider) -> None:
    w = make_world(conn)
    phone = link_parent(conn, w["student"]["learner"])
    first = finish(conn, w, w["lessons"][0], DAY)
    assert "course_completed" not in first and sms.outbox == []          # one lesson left
    last = finish(conn, w, w["lessons"][1], DAY + timedelta(minutes=5))
    assert last["course_completed"]["parent_sms"] == "sent"
    assert len(sms.outbox) == 1
    to, body = sms.outbox[0]
    assert to == phone and "Ravi" in body and "Cells" in body
    finish(conn, w, w["lessons"][1], DAY + timedelta(minutes=10))          # replay
    assert len(sms.outbox) == 1                                           # no second text


def test_quiet_hours_and_no_parent(conn: Connection, sms: FakeSmsProvider) -> None:
    w = make_world(conn, n_lessons=1)
    link_parent(conn, w["student"]["learner"])
    night = finish(conn, w, w["lessons"][0], NIGHT)
    assert night["course_completed"]["parent_sms"] == "queued_quiet" and sms.outbox == []

    lonely = make_world(conn, n_lessons=1)
    assert finish(conn, lonely, lonely["lessons"][0], DAY)["course_completed"][
        "parent_sms"] == "no_parent"


def test_call_student_parent_gets_hindi_text(conn: Connection, client: TestClient,
                                             sms: FakeSmsProvider,
                                             monkeypatch: pytest.MonkeyPatch) -> None:
    calls = Settings(call_hours_enforced=False, twilio_auth_token="", use_fake_telephony=True,
                     public_base_url="")
    monkeypatch.setattr("app.calls.flow.get_settings", lambda: calls)
    monkeypatch.setattr("app.routers.calls.get_settings", lambda: calls)
    monkeypatch.setattr("app.notify.is_quiet", lambda _now: False)
    app.dependency_overrides[telephony] = lambda: FakeTelephonyProvider()
    try:
        w = make_world(conn, n_lessons=1)
        conn.execute(text("update questions set call_safe=true"))
        cs = client.post(f"/v1/classrooms/{w['classroom']}/call-students",
                         headers=w["teacher"]["headers"],
                         json={"name": "Ananya", "phone": "9876500001", "language": "hi",
                               "parent_phone": "9876500002"}).json()
        sid = client.post(f"/v1/call-students/{cs['id']}/call-now",
                          headers=w["teacher"]["headers"]).json()["session_id"]
        client.post(f"/v1/webhooks/twilio/voice?s={sid}", data={"CallSid": "CA1"})
        client.post(f"/v1/webhooks/twilio/lang?s={sid}", data={"Digits": "1"})       # Hindi
        client.post(f"/v1/webhooks/twilio/consent?s={sid}", data={"Digits": "1"})
        for _ in range(3):
            client.post(f"/v1/webhooks/twilio/answer?s={sid}", data={"Digits": "1"})
            client.post(f"/v1/webhooks/twilio/confirm?s={sid}", data={"Digits": "1"})
    finally:
        app.dependency_overrides.pop(telephony, None)
    assert len(sms.outbox) == 1
    to, body = sms.outbox[0]
    assert to == "+919876500002" and "Ananya" in body and "कोर्स पूरा" in body
