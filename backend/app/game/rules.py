"""Game rules from PRD section 3. Pure functions: no database, easy to test."""
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

XP_FIRST_TRY = 10
XP_RETRY = 5
XP_LESSON = 20
XP_PERFECT = 10
COMBO_STEP = 3
COMBO_BONUS = 2
COMBO_BONUS_CAP = 10

GEMS_LESSON = 5
GEMS_QUEST = 20
GEMS_REVISION_QUEST = 40
GEMS_BADGE = 50
FREEZE_COST = 100
HEARTS_REFILL_COST = 50    # decision: PRD leaves this price open
OUTFIT_COST = 30           # decision: PRD leaves this price open
MAX_FREEZES = 2

MAX_HEARTS = 5
HEART_REFILL_MINUTES = 30

SOFT_LIMIT_SECONDS = 45 * 60
QUIET_START_HOUR = 21
QUIET_END_HOUR = 7

MIN_ANSWER_GAP_SECONDS = 1.0
MAX_REPEATS_PER_LESSON = 3

STAGE_COW_XP = 500
STAGE_CHAMPION_XP = 2000
SCENE_XP = 8000


def ist_date(now: datetime) -> date:
    return now.astimezone(IST).date()


def week_start(d: date) -> date:
    """Monday of the week containing d (leagues reset Monday 00:00 IST)."""
    return d - timedelta(days=d.weekday())


def xp_for_answer(correct: bool, first_try: bool) -> int:
    if not correct:
        return 0
    return XP_FIRST_TRY if first_try else XP_RETRY


def combo_bonus(combo_after: int, bonus_so_far: int) -> int:
    """+2 XP for every 3-answer combo, at most +10 per lesson."""
    if combo_after > 0 and combo_after % COMBO_STEP == 0 and bonus_so_far < COMBO_BONUS_CAP:
        return min(COMBO_BONUS, COMBO_BONUS_CAP - bonus_so_far)
    return 0


def refill_hearts(hearts: int, updated_at: datetime, now: datetime) -> tuple[int, datetime]:
    """One heart comes back every 30 minutes, up to 5."""
    if hearts >= MAX_HEARTS:
        return MAX_HEARTS, now
    gained = int((now - updated_at).total_seconds() // (HEART_REFILL_MINUTES * 60))
    if gained <= 0:
        return hearts, updated_at
    hearts += gained
    if hearts >= MAX_HEARTS:
        return MAX_HEARTS, now
    return hearts, updated_at + timedelta(minutes=HEART_REFILL_MINUTES * gained)


def streak_after_goal(streak: int, last_goal_date: date | None, today: date,
                      freezes: int) -> tuple[int, int]:
    """Called when the daily goal is first met today. Returns (streak, freezes left).

    Each missed day uses one stored freeze; a gap bigger than the freezes resets to 1.
    """
    if last_goal_date == today:
        return streak, freezes
    if last_goal_date is None:
        return 1, freezes
    missed = (today - last_goal_date).days - 1
    if missed <= 0:
        return streak + 1, freezes
    if missed <= freezes:
        return streak + 1, freezes - missed
    return 1, freezes


def goal_counts_for_streak(now: datetime) -> bool:
    """Quiet hours: a goal met after 9 pm IST no longer extends the streak."""
    h = now.astimezone(IST).hour
    return QUIET_END_HOUR <= h < QUIET_START_HOUR


def play_seconds_since(last_activity: datetime | None, now: datetime) -> int:
    if last_activity is None:
        return 10
    gap = (now - last_activity).total_seconds()
    if gap > 300:       # a new sitting
        return 10
    return int(min(max(gap, 0), 60))


def is_suspicious(gap_seconds: float | None, repeats: int) -> bool:
    """Impossibly fast or endlessly repeated answers earn no XP."""
    if gap_seconds is not None and gap_seconds < MIN_ANSWER_GAP_SECONDS:
        return True
    return repeats >= MAX_REPEATS_PER_LESSON


def mascot_stage(xp: int) -> str:
    if xp >= STAGE_CHAMPION_XP:
        return "champion"
    if xp >= STAGE_COW_XP:
        return "cow"
    return "calf"
