"""Fast pure-logic tests: twin maths, answer checking and game rules (no database)."""
from datetime import UTC, date, datetime, timedelta, timezone

from app.game import rules as r
from app.game.badges import all_badges, earned
from app.learning.answers import check_answer
from app.twin import model as twin

NOW = datetime(2026, 3, 2, 10, 0, tzinfo=UTC)


def test_first_try_beats_retry_and_wrong_lowers() -> None:
    s = twin.TwinState()
    right = twin.update(s, True, True, NOW)
    retry = twin.update(s, True, False, NOW)
    assert right.mastery > retry.mastery > 0
    wrong = twin.update(right, False, True, NOW)
    assert wrong.mastery < right.mastery
    assert wrong.half_life_days < right.half_life_days


def test_forgetting_halves_after_one_half_life() -> None:
    s = twin.TwinState(mastery=0.8, half_life_days=2.0, last_seen=NOW)
    assert abs(twin.effective_mastery(s, NOW + timedelta(days=2)) - 0.4) < 1e-9


def test_next_review_later_when_stronger() -> None:
    weak = twin.update(twin.TwinState(), True, False, NOW)
    strong = twin.TwinState(mastery=0.95, half_life_days=20.0, last_seen=NOW)
    assert twin.update(strong, True, True, NOW).next_review > weak.next_review  # type: ignore[operator]


def test_stars_and_revision() -> None:
    assert [twin.stars(m) for m in (0.1, 0.4, 0.7, 0.95)] == [0, 1, 2, 3]
    fading = twin.TwinState(mastery=0.8, half_life_days=1.0, last_seen=NOW)
    assert twin.needs_revision(fading, NOW + timedelta(days=3))
    assert not twin.needs_revision(twin.TwinState(), NOW)


def test_answer_checking() -> None:
    assert check_answer("mcq", "A", " a ")
    assert not check_answer("mcq", "A", "B")
    assert check_answer("true_false", True, "true")
    assert not check_answer("true_false", True, "nonsense")
    assert check_answer("match", {"a": "1"}, {"A": "1"})
    assert check_answer("fill_in", ["Cell", "cells"], " CELLS ")


def test_xp_and_combo_rules() -> None:
    assert (r.xp_for_answer(True, True), r.xp_for_answer(True, False),
            r.xp_for_answer(False, True)) == (10, 5, 0)
    assert r.combo_bonus(3, 0) == 2 and r.combo_bonus(2, 0) == 0
    assert r.combo_bonus(15, 10) == 0          # capped at +10 per lesson


def test_hearts_refill_every_30_minutes() -> None:
    h, t = r.refill_hearts(2, NOW, NOW + timedelta(minutes=65))
    assert h == 4 and t == NOW + timedelta(minutes=60)
    assert r.refill_hearts(1, NOW, NOW + timedelta(hours=5))[0] == 5


def test_streak_rules() -> None:
    today = date(2026, 3, 10)
    assert r.streak_after_goal(0, None, today, 0) == (1, 0)
    assert r.streak_after_goal(4, today - timedelta(days=1), today, 0) == (5, 0)
    assert r.streak_after_goal(4, today - timedelta(days=3), today, 2) == (5, 0)   # 2 freezes used
    assert r.streak_after_goal(4, today - timedelta(days=5), today, 2) == (1, 2)   # reset


def test_quiet_hours_and_anti_cheat() -> None:
    ist = timezone(timedelta(hours=5, minutes=30))
    assert r.goal_counts_for_streak(datetime(2026, 3, 2, 15, 0, tzinfo=ist))
    assert not r.goal_counts_for_streak(datetime(2026, 3, 2, 21, 30, tzinfo=ist))
    assert r.is_suspicious(0.2, 0) and r.is_suspicious(5, 3) and not r.is_suspicious(5, 1)


def test_mascot_and_badges() -> None:
    assert [r.mascot_stage(x) for x in (0, 500, 2000)] == ["calf", "cow", "champion"]
    assert r.week_start(date(2026, 3, 8)) == date(2026, 3, 2)      # Sunday -> Monday
    assert 40 <= len(all_badges()) <= 45
    assert {"lessons_1", "streak_7"} <= earned({"lessons_completed": 1, "streak": 7})
