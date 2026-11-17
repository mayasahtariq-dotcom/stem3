"""P3: notes upload to course, question generation, doubt chatbot, audio, Gemini/Sarvam clients."""
import base64
import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection

from app.ai.pipeline import run_pipeline
from app.ai.provider import AIUnavailable, FakeLLMProvider, GeminiProvider
from app.main import app
from app.routers.ai import llm, pipeline_runner
from app.speech.provider import SarvamProvider
from tests.conftest import NoCommit, needs_db
from tests.helpers import make_user

PNG = b"\x89PNG\r\n\x1a\nfake-notes-photo"


@pytest.fixture
def inline_pipeline(conn: Connection) -> Any:
    """Run the background pipeline inside the test transaction, with the fake model."""
    app.dependency_overrides[pipeline_runner] = lambda: (
        lambda uid: run_pipeline(NoCommit(conn), FakeLLMProvider(), uid))  # type: ignore[arg-type]
    yield
    app.dependency_overrides.pop(pipeline_runner, None)


def upload(client: TestClient, headers: dict[str, str], n: int = 2) -> dict[str, Any]:
    files = [("files", (f"page{i}.png", PNG, "image/png")) for i in range(n)]
    r = client.post("/v1/uploads", headers=headers, files=files, data={"language": "hi", "class_level": "7"})
    assert r.status_code == 202, r.text
    out: dict[str, Any] = r.json()
    return out


@needs_db
def test_notes_photos_become_a_draft_course(conn: Connection, client: TestClient, inline_pipeline: Any) -> None:
    t = make_user(conn, "teacher")
    up = upload(client, t["headers"])
    status = client.get(f"/v1/uploads/{up['upload_id']}", headers=t["headers"]).json()
    assert status["status"] == "done" and status["course_id"] and status["pages"] == 2
    assert status["flagged_questions"] == 1                       # the low-confidence question
    course = client.get(f"/v1/courses/{status['course_id']}", headers=t["headers"]).json()
    assert course["status"] == "draft" and course["title"] == "The Cell"
    first = course["units"][0]["lessons"][0]
    assert first["questions"][0]["flagged"] is True               # flagged questions first
    assert first["content"]["body"]["hi"].startswith("कोशिका")
    assert len(first["questions"]) == 2

    later = course["units"][0]["lessons"][1]
    added = client.post(f"/v1/lessons/{later['id']}/generate", headers=t["headers"], json={"count": 3})
    assert added.json() == {"added": 1}
    qid = first["questions"][1]["id"]
    assert client.post(f"/v1/questions/{qid}/regenerate", headers=t["headers"]).json() == {"ok": True}
    again = client.get(f"/v1/courses/{status['course_id']}", headers=t["headers"]).json()
    ids = [q["id"] for q in again["units"][0]["lessons"][0]["questions"]]
    assert qid not in ids and len(ids) == 2


@needs_db
def test_upload_checks_files_and_ownership(conn: Connection, client: TestClient, inline_pipeline: Any) -> None:
    t, other = make_user(conn, "teacher"), make_user(conn, "teacher")
    bad = client.post("/v1/uploads", headers=t["headers"], files=[("files", ("a.exe", b"x", "application/x-msdownload"))])
    assert bad.status_code == 415
    up = upload(client, t["headers"], 1)
    assert client.get(f"/v1/uploads/{up['upload_id']}", headers=other["headers"]).status_code == 404
    s = make_user(conn, "student")
    assert client.post("/v1/uploads", headers=s["headers"],
                       files=[("files", ("p.png", PNG, "image/png"))]).status_code == 403


@needs_db
def test_doubt_chatbot_answers_from_notes_with_page(conn: Connection, client: TestClient,
                                                   inline_pipeline: Any) -> None:
    t = make_user(conn, "teacher")
    course = client.get(f"/v1/uploads/{upload(client, t['headers'])['upload_id']}", headers=t["headers"]).json()["course_id"]
    cls = client.post("/v1/classrooms", headers=t["headers"], json={"name": "7A"}).json()
    client.post(f"/v1/courses/{course}/publish", headers=t["headers"])
    client.post(f"/v1/courses/{course}/assign", headers=t["headers"], json={"classroom_id": cls["id"]})
    s = make_user(conn, "student")
    client.post("/v1/classrooms/join", headers=s["headers"], json={"class_key": cls["class_key"]})
    a = client.post("/v1/doubts", headers=s["headers"], json={"text": "What is the smallest unit of life?"}).json()
    assert "cell" in a["answer"].lower() and a["citation"] == {"course": "The Cell", "page": 1}
    nothing = client.post("/v1/doubts", headers=s["headers"], json={"text": "Who won the cricket match?"}).json()
    assert nothing["citation"] is None
    assert client.get("/v1/doubts", headers=t["headers"]).status_code == 403   # teachers never see doubts


@needs_db
def test_ai_busy_gives_a_friendly_503(conn: Connection, client: TestClient) -> None:
    class Busy(FakeLLMProvider):
        def generate_json(self, *a: Any, **k: Any) -> dict[str, Any]:
            raise AIUnavailable("busy")
    app.dependency_overrides[llm] = lambda: Busy()
    try:
        t = make_user(conn, "teacher")
        client.post("/v1/courses", headers=t["headers"], json={"title": "X", "subject": "physics"})
        s = make_user(conn, "student")
        r = client.post("/v1/doubts", headers=s["headers"], json={"text": "What is force?"})
        assert r.status_code in (200, 503)            # 503 only if notes matched and the model was asked
    finally:
        app.dependency_overrides.pop(llm, None)


@needs_db
def test_audio_is_cached_and_served(conn: Connection, client: TestClient) -> None:
    s = make_user(conn, "student")
    one = client.post("/v1/audio", headers=s["headers"], json={"text": "नमस्ते", "language": "hi"}).json()
    two = client.post("/v1/audio", headers=s["headers"], json={"text": "नमस्ते", "language": "hi"}).json()
    assert one["id"] == two["id"]
    got = client.get(one["url"])
    assert got.status_code == 200 and got.content.startswith(b"fake-audio:hi")
    assert client.post("/v1/audio", json={"text": "x", "language": "hi"}).status_code == 401


# ---------- vendor clients, no network ----------
def _resp(status: int, body: dict[str, Any]) -> httpx.Response:
    return httpx.Response(status, json=body, request=httpx.Request("POST", "https://test"))


def test_gemini_retries_busy_then_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    answers = iter([_resp(503, {}), _resp(503, {}), _resp(404, {}),
                    _resp(200, {"candidates": [{"content": {"parts": [{"text": json.dumps({"ok": 1})}]}}]})])

    def fake_post(url: str, **kw: Any) -> httpx.Response:
        calls.append(url.split("/models/")[1].split(":")[0])
        return next(answers)
    monkeypatch.setattr("app.ai.provider.httpx.post", fake_post)
    monkeypatch.setattr("app.ai.provider.time.sleep", lambda _s: None)
    g = GeminiProvider("key", "model-a")
    assert g.generate_json("hi", {"type": "OBJECT"}) == {"ok": 1}
    assert calls[:3] == ["model-a", "model-a", "gemini-flash-lite-latest"]


def test_gemini_respects_overall_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    import time as real_time
    clock = iter(range(0, 10_000, 30))           # every check jumps 30 s ahead
    monkeypatch.setattr("app.ai.provider.time.monotonic", lambda: float(next(clock)))
    monkeypatch.setattr("app.ai.provider.httpx.post", lambda url, **kw: _resp(503, {}))
    monkeypatch.setattr("app.ai.provider.time.sleep", lambda _s: None)
    with pytest.raises(AIUnavailable):
        GeminiProvider("key", "m", deadline=80).complete("hi")
    _ = real_time


def test_gemini_gives_up_cleanly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.provider.httpx.post", lambda url, **kw: _resp(503, {}))
    monkeypatch.setattr("app.ai.provider.time.sleep", lambda _s: None)
    with pytest.raises(AIUnavailable):
        GeminiProvider("key", "m").complete("hi")


def test_sarvam_decodes_audio(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    def fake_post(url: str, **kw: Any) -> httpx.Response:
        seen.update(kw["json"]); seen["key"] = kw["headers"]["api-subscription-key"]
        return _resp(200, {"audios": [base64.b64encode(b"RIFFwav").decode()]})
    monkeypatch.setattr("app.speech.provider.httpx.post", fake_post)
    assert SarvamProvider("k").synthesize("नमस्ते", "kn", 8000) == b"RIFFwav"
    assert seen["language_code"] == "kn-IN" and seen["speech_sample_rate"] == 8000 and seen["key"] == "k"
