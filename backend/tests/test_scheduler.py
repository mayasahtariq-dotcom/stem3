"""The 5-minute scheduler, with time passed in."""
from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text

from app.auth.sms import FakeSmsProvider
from app.calls.provider import FakeTelephonyProvider
from app.game.rules import IST
from app.jobs.scheduler import slot_for, tick
from tests.conftest import needs_db
from tests.helpers import make_user, make_world

pytestmark = needs_db
WED = datetime(2026, 3, 4, 10, 0, tzinfo=IST)        # a Wednesday morning, IST
SUN_EVENING = datetime(2026, 3, 8, 18, 30, tzinfo=IST)


def call_student(conn: Connection, w: dict[str, Any], phone: str, status: str = "active",
                 consent: bool = True) -> tuple[str, str]:
    cs = conn.execute(text(
        "insert into call_students(classroom_id, name, phone_e164, language, parent_phone_e164, "
        "window_start, window_end, status) values (:k,'Kid',:p,'hi','+919000000999','09:00','21:00',:s) "
        "returning id"), {"k": w["classroom"], "p": phone, "s": status}).scalar_one()
    from app.people import create_learner
    lid = create_learner(conn, call_student_id=cs)
    if consent:
        conn.execute(text("insert into consent_records(learner_id, given_by, granted) values (:l,'parent_keypress',true)"),
                     {"l": lid})
    return str(cs), str(lid)


def mine(phone: FakeTelephonyProvider, number: str) -> list[tuple[str, str]]:
    return [c for c in phone.calls if c[0] == number]


def test_schedules_once_then_places_when_due(conn: Connection) -> None:
    w = make_world(conn)
    cs, _ = call_student(conn, w, "+919111100001")
    phone, sms = FakeTelephonyProvider(), FakeSmsProvider()
    early = datetime(2026, 3, 4, 8, 0, tzinfo=IST)
    tick(conn, phone, sms, early)
    rows = conn.execute(text("select status, scheduled_for from call_sessions where call_student_id=:c"),
                        {"c": cs}).all()
    assert len(rows) == 1 and rows[0][0] == "scheduled"
    slot = slot_for(cs, early.date(), datetime(1, 1, 1, 9).time(), datetime(1, 1, 1, 21).time())
    assert rows[0][1] == slot and mine(phone, "+919111100001") == []
    tick(conn, phone, sms, slot + timedelta(minutes=1))
    tick(conn, phone, sms, slot + timedelta(minutes=2))          # no duplicate call
    assert len(mine(phone, "+919111100001")) == 1
    assert conn.execute(text("select count(*) from call_sessions where call_student_id=:c"),
                        {"c": cs}).scalar_one() == 1


def test_missed_call_retries_twice_then_stops(conn: Connection) -> None:
    w = make_world(conn)
    cs, _ = call_student(conn, w, "+919111100002")
    phone, sms = FakeTelephonyProvider(), FakeSmsProvider()
    t = datetime(2026, 3, 4, 20, 59, tzinfo=IST) - timedelta(hours=2)   # 18:59 IST
    conn.execute(text("insert into call_sessions(call_student_id, scheduled_for, status, kind, learner_id) "
                      "select :c, :t, 'scheduled', 'lesson', id from learners where call_student_id=:c"),
                 {"c": cs, "t": t})
    for _ in range(4):
        tick(conn, phone, sms, t)
        conn.execute(text("update call_sessions set status='missed', ended_at=:t where call_student_id=:c "
                          "and status='ringing'"), {"c": cs, "t": t})
        t += timedelta(minutes=21)
    attempts = conn.execute(text("select attempt from call_sessions where call_student_id=:c order by attempt"),
                            {"c": cs}).scalars().all()
    assert list(attempts) == [1, 2, 3] and len(mine(phone, "+919111100002")) == 3


def test_not_reachable_after_three_days(conn: Connection) -> None:
    w = make_world(conn)
    cs, lid = call_student(conn, w, "+919111100003")
    for d in (1, 2, 3):
        conn.execute(text("insert into call_sessions(call_student_id, scheduled_for, status, kind, learner_id, created_at) "
                          "values (:c, :t, 'missed', 'lesson', :l, :t)"),
                     {"c": cs, "l": lid, "t": WED - timedelta(days=d)})
    tick(conn, FakeTelephonyProvider(), FakeSmsProvider(), WED)
    assert conn.execute(text("select status from call_students where id=:c"), {"c": cs}).scalar_one() == "not_reachable"


def test_consent_calls_parent_for_three_days_only(conn: Connection) -> None:
    w = make_world(conn)
    cs, _ = call_student(conn, w, "+919111100004", status="waiting_consent", consent=False)
    phone = FakeTelephonyProvider()
    for d in range(4):
        day = datetime(2026, 3, 4, 20, 30, tzinfo=IST) + timedelta(days=d)
        tick(conn, phone, FakeSmsProvider(), day)
        conn.execute(text("update call_sessions set status='missed', ended_at=:t, attempt=3 "
                          "where call_student_id=:c and status='ringing'"), {"c": cs, "t": day})
        # 9 pm passes; the next morning starts a new day
    kinds = conn.execute(text("select kind from call_sessions where call_student_id=:c"), {"c": cs}).scalars().all()
    assert list(kinds) == ["consent"] * 3
    assert all(c[0] == "+919000000999" for c in mine(phone, "+919000000999")) and len(mine(phone, "+919000000999")) >= 3


def test_no_consent_no_call(conn: Connection) -> None:
    w = make_world(conn)
    cs, _ = call_student(conn, w, "+919111100005", consent=False)
    tick(conn, FakeTelephonyProvider(), FakeSmsProvider(), WED)
    assert conn.execute(text("select count(*) from call_sessions where call_student_id=:c"), {"c": cs}).scalar_one() == 0


def test_held_parent_sms_goes_out_in_the_morning(conn: Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    w = make_world(conn)
    lid = w["student"]["learner"]
    parent = make_user(conn, "parent")
    conn.execute(text("insert into parent_links values (:p,:l)"), {"p": parent["id"], "l": lid})
    conn.execute(text("insert into course_completions(learner_id, course_id, sms_status) values (:l,:c,'queued_quiet')"),
                 {"l": lid, "c": w["course"]})
    fake = FakeSmsProvider()
    monkeypatch.setattr("app.notify.sms_sender", lambda: fake)
    tick(conn, FakeTelephonyProvider(), FakeSmsProvider(), WED)
    assert conn.execute(text("select sms_status from course_completions where learner_id=:l"),
                        {"l": lid}).scalar_one() == "sent"
    assert len(fake.outbox) == 1 and "Cells" in fake.outbox[0][1]


def test_weekly_sms_once_on_sunday_evening(conn: Connection) -> None:
    w = make_world(conn)
    call_student(conn, w, "+919111100006")
    sms = FakeSmsProvider()
    tick(conn, FakeTelephonyProvider(), sms, SUN_EVENING)
    tick(conn, FakeTelephonyProvider(), sms, SUN_EVENING + timedelta(minutes=5))
    mine_sms = [m for m in sms.outbox if m[0] == "+919111100006"]
    assert len(mine_sms) == 1 and "स्ट्रीक" in mine_sms[0][1]


def test_scheduler_endpoint_is_admin_only(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    assert client.post("/v1/internal/scheduler/tick", headers=w["teacher"]["headers"]).status_code == 403
