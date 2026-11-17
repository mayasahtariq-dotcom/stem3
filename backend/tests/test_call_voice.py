"""Sarvam voices on calls: <Play> clips, caching, fallback to Twilio's voice, pre-recording."""
import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.calls.prewarm import lines_for_course, prewarm_course
from app.calls.provider import FakeTelephonyProvider
from app.config import Settings
from app.main import app
from app.routers.calls import telephony
from app.speech.provider import FakeSpeechProvider
from tests.conftest import needs_db
from tests.helpers import make_call_safe, make_world

pytestmark = needs_db
BASE = "https://aaroh.test"


@pytest.fixture
def sarvam_calls(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    s = Settings(call_hours_enforced=False, twilio_auth_token="", use_fake_telephony=True,
                 public_base_url=BASE, use_fake_speech=True)
    for target in ("app.calls.flow.get_settings", "app.routers.calls.get_settings",
                   "app.calls.voice.get_settings"):
        monkeypatch.setattr(target, lambda: s)
    monkeypatch.setattr("app.calls.voice.enabled", lambda: True)
    app.dependency_overrides[telephony] = lambda: FakeTelephonyProvider()
    yield
    app.dependency_overrides.pop(telephony, None)


def start_call(conn: Connection, client: TestClient) -> str:
    w = make_world(conn)
    make_call_safe(conn, w["course"])
    cs = client.post(f"/v1/classrooms/{w['classroom']}/call-students", headers=w["teacher"]["headers"],
                     json={"name": "Ananya", "phone": "9876500001", "language": "hi"}).json()
    return str(client.post(f"/v1/call-students/{cs['id']}/call-now",
                           headers=w["teacher"]["headers"]).json()["session_id"])


def test_lines_become_sarvam_clips_and_are_cached(conn: Connection, client: TestClient,
                                                  sarvam_calls: None) -> None:
    sid = start_call(conn, client)
    menu = client.post(f"/v1/webhooks/twilio/voice?s={sid}", data={"CallSid": "CA1"}).text
    assert menu.count("<Play>") == 3 and "<Say" not in menu       # hi, kn, en menu lines
    assert f"<Play>{BASE}/v1/audio/" in menu
    clip = menu.split(f"<Play>{BASE}")[1].split("</Play>")[0]
    assert client.get(clip).content.startswith(b"fake-audio:hi")
    before = conn.execute(text("select count(*) from audio_cache")).scalar_one()
    client.post(f"/v1/webhooks/twilio/voice?s={sid}", data={"CallSid": "CA1"})   # same menu again
    assert conn.execute(text("select count(*) from audio_cache")).scalar_one() == before


def test_falls_back_to_twilio_voice_on_errors_and_slowness(conn: Connection, client: TestClient,
                                                           sarvam_calls: None,
                                                           monkeypatch: pytest.MonkeyPatch) -> None:
    class Broken(FakeSpeechProvider):
        def synthesize(self, text: str, language: str, sample_rate: int = 22050) -> bytes:
            raise RuntimeError("sarvam down")
    monkeypatch.setattr("app.calls.voice.get_speech", lambda _s: Broken())
    sid = start_call(conn, client)
    out = client.post(f"/v1/webhooks/twilio/voice?s={sid}", data={"CallSid": "CA1"}).text
    assert "<Play>" not in out and out.count("<Say") == 3

    class Slow(FakeSpeechProvider):
        def synthesize(self, text: str, language: str, sample_rate: int = 22050) -> bytes:
            time.sleep(0.5)
            return b"late"
    monkeypatch.setattr("app.calls.voice.get_speech", lambda _s: Slow())
    monkeypatch.setattr("app.calls.voice.BUDGET_SECONDS", 0.05)
    sid2 = start_call(conn, client)
    slow = client.post(f"/v1/webhooks/twilio/voice?s={sid2}", data={"CallSid": "CA2"}).text
    assert "<Play>" not in slow and "<Say" in slow


def test_prewarm_records_question_lines_once(conn: Connection) -> None:
    w = make_world(conn)
    make_call_safe(conn, w["course"])
    want: Any = lines_for_course(conn, w["course"])
    assert ("Q0", "en") in {(t, lang) for t, lang in want}
    assert any("Press 1 for A" in t for t, _ in want)
    made = prewarm_course(conn, w["course"])
    assert made == len(want)
    assert prewarm_course(conn, w["course"]) == 0               # everything cached now
