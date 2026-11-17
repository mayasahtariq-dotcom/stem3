import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.providers import get_llm, get_speech, get_telephony


def test_health() -> None:
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_fakes_work_without_keys() -> None:
    s = Settings()
    assert get_llm(s).complete("hi").startswith("[fake-llm]")
    assert get_speech(s).synthesize("namaste", "hi").startswith(b"fake-audio:hi")
    assert get_telephony(s).place_call("+919999999999", "s1") == "fake-call-1"


def test_real_providers_not_wired_yet() -> None:
    s = Settings(use_fake_ai=False, gemini_api_key="")
    with pytest.raises(NotImplementedError):
        get_llm(s)


def test_cors_allows_the_web_app_origin() -> None:
    r = TestClient(app).options("/v1/auth/otp", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = TestClient(app).options("/v1/auth/otp", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
