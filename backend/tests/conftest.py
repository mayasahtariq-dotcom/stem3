"""Shared fixtures. Tests run on the real database inside a transaction that is rolled back."""
import os

# Tests must never reach real phone, SMS or AI services, whatever backend/.env says.
# Environment variables beat the .env file in pydantic-settings.
os.environ.update({"USE_FAKE_TELEPHONY": "true", "USE_FAKE_SMS": "true", "USE_FAKE_AI": "true",
                   "USE_FAKE_SPEECH": "true", "TWILIO_AUTH_TOKEN": "", "DEMO_MODE": "false",
                   "PUBLIC_BASE_URL": ""})

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


class NoCommit:
    """Delegates to a real connection but ignores commit/rollback so the test can roll back."""

    def __init__(self, conn: Connection) -> None:
        self._c = conn

    def commit(self) -> None: ...
    def rollback(self) -> None: ...

    def __getattr__(self, name: str) -> Any:
        return getattr(self._c, name)


needs_db = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL not set")


@pytest.fixture
def conn() -> Iterator[Connection]:
    c = get_engine().connect()
    trans = c.begin()
    try:
        yield c
    finally:
        trans.rollback()
        c.close()


@pytest.fixture
def client(conn: Connection) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: NoCommit(conn)
    app.dependency_overrides[get_sms] = lambda: FakeSmsProvider()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def uid() -> str:
    return str(uuid.uuid4())
