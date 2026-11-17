"""Auth tests on the real database; a wrapper stops commits so everything rolls back."""
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection

from app.auth.sms import FakeSmsProvider, get_sms
from app.config import get_settings
from app.db.session import get_db, get_engine
from app.main import app

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL not set")


class NoCommit:
    """Delegates to a real connection but ignores commit/rollback so the test can roll back."""

    def __init__(self, conn: Connection) -> None:
        self._c = conn

    def commit(self) -> None: ...
    def rollback(self) -> None: ...

    def __getattr__(self, name: str) -> Any:
        return getattr(self._c, name)


@pytest.fixture
def client() -> Iterator[tuple[TestClient, FakeSmsProvider]]:
    sms = FakeSmsProvider()
    conn = get_engine().connect()
    trans = conn.begin()
    app.dependency_overrides[get_db] = lambda: NoCommit(conn)
    app.dependency_overrides[get_sms] = lambda: sms
    try:
        yield TestClient(app), sms
    finally:
        app.dependency_overrides.clear()
        trans.rollback()
        conn.close()


def phone() -> str:
    return "+9198" + str(uuid.uuid4().int)[:8]


def test_otp_signup_and_login(client: tuple[TestClient, FakeSmsProvider]) -> None:
    c, sms = client
    p = phone()
    assert c.post("/v1/auth/otp", json={"phone": p}).status_code == 204
    r = c.post("/v1/auth/verify", json={"phone": p, "code": sms.last_code(p),
                                         "role": "teacher", "name": "Asha"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "teacher"
    me = c.get("/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["name"] == "Asha"


def test_wrong_code_rejected_and_attempts_limited(
    client: tuple[TestClient, FakeSmsProvider]
) -> None:
    c, sms = client
    p = phone()
    c.post("/v1/auth/otp", json={"phone": p})
    real = sms.last_code(p)
    bad = "000000" if real != "000000" else "111111"
    for _ in range(5):
        assert c.post("/v1/auth/verify", json={"phone": p, "code": bad}).status_code == 400
    assert c.post("/v1/auth/verify", json={"phone": p, "code": real}).status_code == 429


def test_new_account_needs_role_and_name(client: tuple[TestClient, FakeSmsProvider]) -> None:
    c, sms = client
    p = phone()
    c.post("/v1/auth/otp", json={"phone": p})
    r = c.post("/v1/auth/verify", json={"phone": p, "code": sms.last_code(p)})
    assert r.status_code == 422


def test_admin_role_cannot_be_self_assigned(client: tuple[TestClient, FakeSmsProvider]) -> None:
    c, sms = client
    p = phone()
    c.post("/v1/auth/otp", json={"phone": p})
    r = c.post("/v1/auth/verify", json={"phone": p, "code": sms.last_code(p),
                                         "role": "admin", "name": "x"})
    assert r.status_code == 422


def test_otp_send_cap_per_phone(client: tuple[TestClient, FakeSmsProvider]) -> None:
    c, _ = client
    p = phone()
    codes = [c.post("/v1/auth/otp", json={"phone": p}).status_code for _ in range(6)]
    assert codes[:5] == [204] * 5
    assert codes[5] == 429


def test_class_key_login_creates_then_reuses_student(
    client: tuple[TestClient, FakeSmsProvider]
) -> None:
    c, sms = client
    tp = phone()
    c.post("/v1/auth/otp", json={"phone": tp})
    t = c.post("/v1/auth/verify", json={"phone": tp, "code": sms.last_code(tp),
                                         "role": "teacher", "name": "T"}).json()
    from app.db.session import get_db as gd
    conn = app.dependency_overrides[gd]()
    key = "K" + uuid.uuid4().hex[:7].upper()
    conn.execute(__import__("sqlalchemy").text(
        "insert into classrooms(teacher_id, name, class_key) values (:t,'A',:k)"),
        {"t": t["user"]["id"], "k": key})
    first = c.post("/v1/auth/class-key", json={"class_key": key.lower(), "name": "Ravi"}).json()
    again = c.post("/v1/auth/class-key", json={"class_key": key, "name": "ravi"}).json()
    assert first["user"]["id"] == again["user"]["id"]
    assert c.post("/v1/auth/class-key", json={"class_key": "NOPE1234", "name": "x"}
                  ).status_code == 404


def test_me_requires_token(client: tuple[TestClient, FakeSmsProvider]) -> None:
    c, _ = client
    assert c.get("/v1/auth/me").status_code == 401
    assert c.get("/v1/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401
