"""Demo console API: hidden unless DEMO_MODE, seed works, live state shows the call."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection

from app.calls.provider import FakeTelephonyProvider
from app.config import Settings
from app.demo import seed_demo
from app.main import app
from app.routers.calls import telephony
from tests.conftest import needs_db

pytestmark = needs_db


def test_demo_hidden_when_off(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.demo.get_settings", lambda: Settings(demo_mode=False))
    assert client.get("/demo").status_code == 404
    assert client.post("/v1/demo/login").status_code == 404


def test_demo_seed_login_state_and_live_call(conn: Connection, client: TestClient,
                                             monkeypatch: pytest.MonkeyPatch) -> None:
    on = Settings(demo_mode=True, demo_phone="9876512345", call_hours_enforced=False,
                  twilio_auth_token="", use_fake_telephony=True, public_base_url="",
                  twilio_number="+15550001111")
    for target in ("app.routers.demo.get_settings", "app.routers.calls.get_settings",
                   "app.calls.flow.get_settings"):
        monkeypatch.setattr(target, lambda: on)
    app.dependency_overrides[telephony] = lambda: FakeTelephonyProvider()
    try:
        seed_demo(conn, "9876512345", None)
        assert "Aaroh" in client.get("/demo").text
        login = client.post("/v1/demo/login").json()
        h = {"Authorization": f"Bearer {login['token']}"}
        state = client.get("/v1/demo/state", headers=h).json()
        assert state["student"]["status"] == "waiting_consent" and len(state["league"]) == 5
        assert "12345" not in state["student"]["phone"][:-3]          # phone is masked
        assert state["courses"] == []                                 # no canned courses

        # The teacher's real course (here imported directly; normally from POST /v1/uploads)
        course = client.post("/v1/courses", headers=h, json={"title": "Cells", "subject": "biology"}).json()["id"]
        client.post(f"/v1/courses/{course}/content", headers=h, json={"units": [{"title": "U", "lessons": [
            {"title": "The Cell", "questions": [{"kind": "mcq", "call_safe": True,
             "prompt": {"en": "What is the smallest unit of life?", "hi": "जीवन की सबसे छोटी इकाई?"},
             "options": [{"en": "Cell", "hi": "कोशिका"}, {"en": "Organ", "hi": "अंग"}],
             "answer": {"en": "Cell", "hi": "कोशिका"}, "concept": "cell"}]}]}]})
        client.post(f"/v1/courses/{course}/publish", headers=h)
        client.post(f"/v1/courses/{course}/assign", headers=h, json={"classroom_id": state["classroom_id"]})
        listed = client.get("/v1/demo/state", headers=h).json()["courses"]
        assert listed[0]["status"] == "published" and listed[0]["questions"] == 1

        sid = client.post(f"/v1/call-students/{login['call_student_id']}/call-now",
                          headers=h).json()["session_id"]
        for path, digit in [("voice", None), ("lang", "3"), ("consent", "1"),
                            ("answer", "1"), ("confirm", "1")]:
            data = {"CallSid": "CA1"} | ({"Digits": digit} if digit else {})
            assert client.post(f"/v1/webhooks/twilio/{path}?s={sid}", data=data).status_code == 200
        live = client.get("/v1/demo/state", headers=h).json()
        kinds = [e["kind"] for e in live["call"]["events"]]
        assert kinds[:4] == ["placed", "language", "consent", "lesson_started"]
        answer = next(e["payload"] for e in live["call"]["events"] if e["kind"] == "answer")
        assert kinds[-1] == "finished"
        assert answer["correct"] and answer["question"] == "What is the smallest unit of life?"
        assert live["student"]["xp"] >= 10 and live["twin"][0]["concept"] == "cell"
    finally:
        app.dependency_overrides.pop(telephony, None)
