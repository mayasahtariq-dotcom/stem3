"""Student Twin maths: mastery, forgetting and next review. Pure functions, no I/O."""
import math
from dataclasses import dataclass
from datetime import datetime, timedelta

REVIEW_THRESHOLD = 0.6
MAX_HALF_LIFE_DAYS = 60.0


@dataclass(frozen=True)
class TwinState:
    mastery: float = 0.0
    half_life_days: float = 1.0
    last_seen: datetime | None = None
    next_review: datetime | None = None


def effective_mastery(state: TwinState, now: datetime) -> float:
    """Mastery after forgetting: halves every half-life since the concept was last seen."""
    if state.last_seen is None:
        return state.mastery
    days = max((now - state.last_seen).total_seconds() / 86400, 0.0)
    return float(state.mastery * 0.5 ** (days / state.half_life_days))


def update(state: TwinState, correct: bool, first_try: bool, now: datetime) -> TwinState:
    eff = effective_mastery(state, now)
    if correct:
        gain = 0.30 if first_try else 0.15
        mastery = eff + (1 - eff) * gain
        half_life = min(state.half_life_days * (1.8 if first_try else 1.2), MAX_HALF_LIFE_DAYS)
    else:
        mastery = eff * 0.7
        half_life = max(1.0, state.half_life_days * 0.5)
    if mastery > REVIEW_THRESHOLD:
        days = half_life * math.log2(mastery / REVIEW_THRESHOLD)
    else:
        days = 0.5
    return TwinState(mastery, half_life, now, now + timedelta(days=max(days, 0.25)))


def stars(mastery: float) -> int:
    """1 to 3 mastery stars per concept (0 = not yet)."""
    if mastery >= 0.9:
        return 3
    if mastery >= 0.7:
        return 2
    if mastery >= 0.4:
        return 1
    return 0


def needs_revision(state: TwinState, now: datetime) -> bool:
    if state.last_seen is None:
        return False
    return effective_mastery(state, now) < REVIEW_THRESHOLD or (
        state.next_review is not None and state.next_review <= now
    )
