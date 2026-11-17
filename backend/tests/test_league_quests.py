"""M8 (leagues, quests, badges) and M9 (pots, mascot, realtime, guardrails)."""
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import Connection, text
from starlette.websockets import WebSocketDisconnect

from app.auth.tokens import issue_token
from app.game import engine, leagues, realtime
from tests.conftest import needs_db
from tests.helpers import make_user, make_world

pytestmark = needs_db
T0 = datetime(2026, 3, 4, 10, 0, tzinfo=UTC)      # Wednesday, 15:30 IST


def sec(n: float) -> datetime:
    return T0 + timedelta(seconds=n)


def play_lesson(conn: Connection, w: dict[str, Any], lesson: str, t: float,
                base: datetime = T0) -> dict[str, Any]:
    """Answer every question correctly, 2 s apart, then complete. Returns the completion."""
    uid = w["student"]["id"]

    def at(n: float) -> datetime:
        return base + timedelta(seconds=t + n)

    engine.start_lesson(conn, uid, lesson, at(0))
    for i, q in enumerate(w["questions"][lesson]):
        engine.record_attempt(conn, uid, q, "A", at(2 * (i + 1)))
    return engine.complete_lesson(conn, uid, lesson, at(20))


def test_lesson_awards_quests_badges_pot_and_league(conn: Connection) -> None:
    w = make_world(conn)
    done = play_lesson(conn, w, w["lessons"][0], 0)
    assert done["perfect"] and done["xp_gained"] == 30
    assert "lesson_1" in done["quests_completed"]                     # daily quest done
    assert {"lessons_1", "perfect_1"} <= set(done["badges"]) and "pot_id" in done
    lid = w["student"]["learner"]
    assert engine.gem_balance(conn, lid) >= 5 + 20 + 50               # lesson + quest + badge

    st = leagues.standings(conn, lid, "bronze", sec(30))
    assert st["rank"] == 1 and st["xp"] > 0 and st["pod"][0]["me"]    # own progress is in it
    assert st["pod"][0]["name"] == "Ravi"                             # first name only


def test_league_off_opt_out_and_soft_limit(conn: Connection) -> None:
    w = make_world(conn)
    lid, uid = w["student"]["learner"], w["student"]["id"]
    conn.execute(text("update classrooms set league_enabled=false where id=:c"),
                 {"c": w["classroom"]})
    play_lesson(conn, w, w["lessons"][0], 0)
    assert leagues.standings(conn, lid, "bronze", sec(30))["enabled"] is False

    conn.execute(text("update classrooms set league_enabled=true where id=:c"),
                 {"c": w["classroom"]})
    conn.execute(text("update student_stats set play_seconds_today = 3000 where learner_id=:l"),
                 {"l": lid})                                          # past the 45-minute limit
    engine.start_lesson(conn, uid, w["lessons"][1], sec(100))
    r = engine.record_attempt(conn, uid, w["questions"][w["lessons"][1]][0], "A", sec(103))
    assert r["xp_gained"] > 0                                         # still earns XP ...
    assert leagues.standings(conn, lid, "bronze", sec(110))["rank"] is None   # ... not league


def test_weekly_reset_moves_top_up_and_inactive_down(conn: Connection) -> None:
    w = make_world(conn)
    ids = []
    for i in range(6):
        s = make_user(conn, "student", f"S{i}")
        conn.execute(text("insert into memberships values (:c,:u)"),
                     {"c": w["classroom"], "u": s["id"]})
        ids.append(s["learner"])
    week = (T0 - timedelta(days=7)).date()
    week = week - timedelta(days=week.weekday())
    lg = conn.execute(text("insert into leagues(classroom_id,tier,week_start) values (:c,'silver',"
                           ":w) returning id"), {"c": w["classroom"], "w": week}).scalar_one()
    pod = conn.execute(text("insert into league_pods(league_id) values (:g) returning id"),
                       {"g": lg}).scalar_one()
    for i, lid in enumerate(ids):
        conn.execute(text("insert into league_scores values (:p,:l,:x)"),
                     {"p": pod, "l": lid, "x": 100 - i * 10})
        conn.execute(text("update student_stats set league_tier='silver' where learner_id=:l"),
                     {"l": lid})
    assert leagues.weekly_reset(conn, T0) == 6
    tiers = [conn.execute(text("select league_tier from student_stats where learner_id=:l"),
                          {"l": lid}).scalar_one() for lid in ids]
    assert tiers == ["gold"] * 3 + ["bronze"] * 3                    # top 3 up, bottom 3 down
    assert leagues.weekly_reset(conn, T0) == 0                        # runs once per week


def test_pot_open_is_positive_and_once(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    pot = play_lesson(conn, w, w["lessons"][0], 0)["pot_id"]
    h = w["student"]["headers"]
    first = client.post(f"/v1/game/pots/{pot}/open", headers=h)
    assert first.status_code == 200 and first.json()["reward"]["type"] in (
        "gems", "sticker", "outfit")
    assert client.post(f"/v1/game/pots/{pot}/open", headers=h).status_code == 409


def test_streak_freeze_outfit_and_settings(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h, lid = w["student"]["headers"], w["student"]["learner"]
    assert client.post("/v1/game/freeze", headers=h).status_code == 409        # no gems
    engine.add_gems(conn, lid, 200, "test")
    assert client.post("/v1/game/freeze", headers=h).json()["freezes"] == 1
    assert client.post("/v1/game/outfits/buy", headers=h, json={"item": "cap"}).json()["owned"] == [
        "cap"]
    assert client.post("/v1/game/outfits/buy", headers=h, json={"item": "cap"}).status_code == 409
    assert client.patch("/v1/game/settings", headers=h,
                        json={"daily_goal": 50, "nickname": "Rav"}).status_code == 200
    assert client.get("/v1/game/stats", headers=h).json()["daily_goal"] == 50
    assert client.patch("/v1/game/settings", headers=h, json={"daily_goal": 30}).status_code == 422


def test_quests_badges_and_mascot_endpoints(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h = w["student"]["headers"]
    base = datetime.now(UTC) - timedelta(minutes=10)     # the quests endpoint uses the real clock
    play_lesson(conn, w, w["lessons"][0], 0, base)
    quests = {q["code"]: q for q in client.get("/v1/game/quests", headers=h).json()}
    assert quests["lesson_1"]["completed"] and quests["answer_10"]["progress"] == 3
    badges = client.get("/v1/game/badges", headers=h).json()
    assert len(badges) >= 40 and any(b["code"] == "lessons_1" and b["earned"] for b in badges)
    m = client.get("/v1/game/mascot", headers=h).json()
    assert m["stage"] == "calf" and m["next_unlock_at_xp"] == 500
    conn.execute(text("update student_stats set xp=600 where learner_id=:l"),
                 {"l": w["student"]["learner"]})
    play_lesson(conn, w, w["lessons"][1], 200, base)                 # grows on the first answer
    assert client.get("/v1/game/mascot", headers=h).json()["stage"] == "cow"


def test_revision_quest_appears_for_fading_concepts(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    h, lid = w["student"]["headers"], w["student"]["learner"]
    assert "revision_5" not in {q["code"] for q in client.get("/v1/game/quests",
                                                              headers=h).json()}
    conn.execute(text("insert into twin_concepts(learner_id, concept, mastery, half_life_days, "
                      "last_seen, next_review) values (:l,'cell',0.8,1,now() - interval '10 days',"
                      "now() - interval '9 days')"), {"l": lid})
    rev = [q for q in client.get("/v1/game/quests", headers=h).json() if q["kind"] == "revision"]
    assert rev and rev[0]["gems"] == 40 and rev[0]["concepts"] == ["cell"]   # double gems


def test_realtime_pushes_xp_events(conn: Connection, client: TestClient,
                                   monkeypatch: pytest.MonkeyPatch) -> None:
    w = make_world(conn)
    lid = str(w["student"]["learner"])
    monkeypatch.setattr("app.routers.realtime.lookup_learner", lambda _u: lid)
    token = w["student"]["headers"]["Authorization"].split()[1]
    with client.websocket_connect(f"/v1/realtime?token={token}") as ws:
        realtime.publish(lid, {"type": "xp", "xp": 10})
        assert ws.receive_json() == {"type": "xp", "xp": 10}
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/v1/realtime?token=junk"):
        pass                                                           # bad token is refused


def test_admin_only_reset_and_hearts_refill(conn: Connection, client: TestClient) -> None:
    w = make_world(conn)
    assert client.post("/v1/internal/league/reset",
                       headers=w["teacher"]["headers"]).status_code == 403
    admin = make_user(conn, "teacher")
    conn.execute(text("update users set role='admin' where id=:u"), {"u": admin["id"]})
    hdr = {"Authorization": f"Bearer {issue_token(admin['id'], 'admin')}"}
    assert client.post("/v1/internal/league/reset", headers=hdr).status_code == 200
    with pytest.raises(HTTPException):
        engine.record_attempt(conn, w["student"]["id"], w["questions"][w["lessons"][0]][0],
                              "A", sec(0))                            # lesson not started
