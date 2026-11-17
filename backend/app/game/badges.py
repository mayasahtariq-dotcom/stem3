"""Badge definitions (about 40) and who has earned what, from a stats snapshot."""
from typing import Any

LADDERS: dict[str, tuple[str, list[int]]] = {
    "lessons": ("lessons_completed", [1, 5, 10, 25, 50, 100]),
    "streak": ("streak", [3, 7, 14, 30, 60, 100]),
    "xp": ("xp", [100, 500, 1000, 2500, 5000, 10000]),
    "perfect": ("perfect_lessons", [1, 5, 10, 25]),
    "quests": ("quests_completed", [5, 25, 50]),
    "pots": ("pots_opened", [5, 25]),
    "combo": ("best_combo", [3, 6, 9]),
    "doubts": ("doubts", [1, 5, 25]),
    "gems": ("gems_total", [100, 500, 1000]),
    "mastered": ("mastered_concepts", [1, 5, 10]),
}

NAMED = {
    "lessons_1": "First Lesson", "streak_7": "7-Day Streak", "doubts_5": "Doubt Detective",
    "streak_30": "30-Day Streak", "lessons_100": "Century Learner",
}
SPECIAL = {"comeback_kid": "Comeback Kid", "cell_master": "Cell Master",
           "cow_stage": "Golu the Cow", "champion_stage": "Champion Golu"}


def _title(kind: str, n: int) -> str:
    return NAMED.get(f"{kind}_{n}", f"{kind.replace('_', ' ').title()} {n}")


def all_badges() -> dict[str, str]:
    """code -> English title. Hindi and Kannada titles come from P3's copy pass."""
    out = {f"{k}_{n}": _title(k, n) for k, (_, steps) in LADDERS.items() for n in steps}
    out.update(SPECIAL)
    return out


def earned(stats: dict[str, Any]) -> set[str]:
    got: set[str] = set()
    for kind, (key, steps) in LADDERS.items():
        got |= {f"{kind}_{n}" for n in steps if stats.get(key, 0) >= n}
    if stats.get("comeback"):
        got.add("comeback_kid")
    if stats.get("cell_mastery", 0) >= 0.8:
        got.add("cell_master")
    if stats.get("stage") in ("cow", "champion"):
        got.add("cow_stage")
    if stats.get("stage") == "champion":
        got.add("champion_stage")
    return got
