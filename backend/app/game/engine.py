"""Server-side game engine: attempts, XP, combo, hearts, streak, gems, lessons."""
import json
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.deps import has_consent, learner_id_for
from app.game import hooks, realtime
from app.game import rules as r
from app.learning.answers import check_answer
from app.twin import model as twin

STAT_COLS = ["xp", "streak", "last_goal_date", "hearts", "hearts_updated_at", "freezes",
             "today_xp", "today_date", "play_seconds_today", "last_activity_at", "league_tier",
             "best_combo", "lessons_completed", "perfect_lessons", "quests_completed",
             "pots_opened", "daily_goal"]
LESSON_SIZE = 8


def utcnow() -> datetime:
    return datetime.now(UTC)


# ---------- gems ----------
def add_gems(db: Connection, lid: Any, delta: int, reason: str) -> None:
    db.execute(text("insert into gems_ledger(learner_id, delta, reason) values (:l,:d,:r)"),
               {"l": lid, "d": delta, "r": reason})


def gem_balance(db: Connection, lid: Any) -> int:
    return int(db.execute(text("select coalesce(sum(delta),0) from gems_ledger "
                               "where learner_id=:l"), {"l": lid}).scalar_one())


# ---------- stats ----------
def load_stats(db: Connection, lid: Any, now: datetime, lock: bool = True) -> dict[str, Any]:
    sql = "select * from student_stats where learner_id=:l" + (" for update" if lock else "")
    st = dict(db.execute(text(sql), {"l": lid}).mappings().one())
    today = r.ist_date(now)
    if st["today_date"] != today:
        st["today_xp"], st["play_seconds_today"], st["today_date"] = 0, 0, today
    st["hearts"], st["hearts_updated_at"] = r.refill_hearts(
        st["hearts"], st["hearts_updated_at"], now)
    return st


def save_stats(db: Connection, lid: Any, st: dict[str, Any]) -> None:
    sets = ", ".join(f"{c} = :{c}" for c in STAT_COLS)
    db.execute(text(f"update student_stats set {sets} where learner_id = :_l"),
               {**{c: st[c] for c in STAT_COLS}, "_l": lid})


def display_streak(st: dict[str, Any], now: datetime) -> int:
    last = st["last_goal_date"]
    if last is None:
        return 0
    missed = (r.ist_date(now) - last).days - 1
    return int(st["streak"]) if missed <= st["freezes"] else 0


def public_stats(db: Connection, lid: Any, st: dict[str, Any], now: datetime) -> dict[str, Any]:
    return {"xp": st["xp"], "streak": display_streak(st, now), "hearts": st["hearts"],
            "gems": gem_balance(db, lid), "daily_goal": st["daily_goal"],
            "today_xp": st["today_xp"], "freezes": st["freezes"],
            "stage": r.mascot_stage(st["xp"]), "league_tier": st["league_tier"]}


def grant_xp(st: dict[str, Any], xp: int, now: datetime) -> None:
    st["xp"] += xp
    st["today_xp"] += xp
    today = r.ist_date(now)
    if (st["today_xp"] >= st["daily_goal"] and st["last_goal_date"] != today
            and r.goal_counts_for_streak(now)):
        st["streak"], st["freezes"] = r.streak_after_goal(
            st["streak"], st["last_goal_date"], today, st["freezes"])
        st["last_goal_date"] = today


# ---------- twin ----------
def twin_state(db: Connection, lid: Any, concept: str) -> twin.TwinState:
    row = db.execute(text("select mastery, half_life_days, last_seen, next_review from "
                          "twin_concepts where learner_id=:l and concept=:c"),
                     {"l": lid, "c": concept}).mappings().first()
    return twin.TwinState(**row) if row else twin.TwinState()


def save_twin(db: Connection, lid: Any, concept: str, s: twin.TwinState) -> None:
    db.execute(text(
        "insert into twin_concepts(learner_id, concept, mastery, half_life_days, last_seen, "
        "next_review) values (:l,:c,:m,:h,:s,:n) on conflict (learner_id, concept) do update set "
        "mastery=:m, half_life_days=:h, last_seen=:s, next_review=:n"),
        {"l": lid, "c": concept, "m": s.mastery, "h": s.half_life_days,
         "s": s.last_seen, "n": s.next_review})


def record_confusion(db: Connection, lid: Any, concept: str, chosen: Any) -> None:
    db.execute(text(
        "insert into twin_confusions(learner_id, concept, confused_with) values (:l,:c,:w) "
        "on conflict (learner_id, concept, confused_with) do update set "
        "count = twin_confusions.count + 1"),
        {"l": lid, "c": concept, "w": str(chosen)[:80]})


# ---------- access ----------
def check_lesson_access(db: Connection, user_id: str, lesson_id: str) -> None:
    ok = db.execute(text(
        "select exists (select 1 from lessons l join units u on u.id=l.unit_id "
        "join courses c on c.id=u.course_id join course_assignments a on a.course_id=c.id "
        "join memberships m on m.classroom_id=a.classroom_id "
        "where l.id=:le and m.user_id=:u and c.status='published')"),
        {"le": lesson_id, "u": user_id}).scalar()
    if not ok:
        raise HTTPException(404, "Lesson not found")


def _require_consent(db: Connection, lid: Any) -> None:
    if not has_consent(db, lid):
        raise HTTPException(403, "A parent or school must give consent first")


# ---------- lessons ----------
def lesson_questions(db: Connection, lid: Any, lesson_id: str) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select q.id, q.kind, q.prompt, q.options, q.concept, q.call_safe from questions q "
        "left join twin_concepts t on t.learner_id=:l and t.concept = coalesce(q.concept, "
        "q.lesson_id::text) where q.lesson_id=:le "
        "order by coalesce(t.mastery, 0) asc, q.id limit :n"),
        {"l": lid, "le": lesson_id, "n": LESSON_SIZE}).mappings().all()
    return [{**dict(x), "id": str(x["id"])} for x in rows]


def start_lesson(db: Connection, user_id: str, lesson_id: str,
                 now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or utcnow()
    lid = learner_id_for(db, user_id)
    check_lesson_access(db, user_id, lesson_id)
    _require_consent(db, lid)
    prev_done = db.execute(text(
        "select not exists (select 1 from lessons l2 join units u2 on u2.id=l2.unit_id "
        "join lessons cur on cur.id=:le join units cu on cu.id=cur.unit_id "
        "left join lesson_progress p on p.lesson_id=l2.id and p.learner_id=:l "
        "where u2.course_id=cu.course_id and (u2.position, l2.position) < (cu.position, cur.position) "
        "and p.completed_at is null)"), {"le": lesson_id, "l": lid}).scalar()
    if not prev_done:
        raise HTTPException(409, "Finish the earlier lessons first")
    st = load_stats(db, lid, now)
    if st["hearts"] == 0:
        raise HTTPException(409, "No hearts left. Practice to earn one back.")
    save_stats(db, lid, st)
    db.execute(text(
        "insert into lesson_progress(learner_id, lesson_id, status, started_at) "
        "values (:l,:le,'started',:n) on conflict (learner_id, lesson_id) do update set "
        "status='started', started_at=:n, combo=0, max_combo=0, combo_bonus=0, xp_earned=0, "
        "wrong=0, perfect=false"), {"l": lid, "le": lesson_id, "n": now})
    return lesson_questions(db, lid, lesson_id)


# ---------- attempts ----------
def record_attempt(db: Connection, user_id: str, question_id: str, given: Any,
                   now: datetime | None = None) -> dict[str, Any]:
    now = now or utcnow()
    lid = learner_id_for(db, user_id)
    q = db.execute(text("select id, kind, answer, concept, lesson_id from questions where id=:q"),
                   {"q": question_id}).mappings().first()
    if q is None:
        raise HTTPException(404, "Question not found")
    check_lesson_access(db, user_id, str(q["lesson_id"]))
    _require_consent(db, lid)
    prog = db.execute(text(
        "select started_at, combo, max_combo, combo_bonus, xp_earned, wrong, status from "
        "lesson_progress where learner_id=:l and lesson_id=:le for update"),
        {"l": lid, "le": q["lesson_id"]}).mappings().first()
    if prog is None or prog["status"] != "started":
        raise HTTPException(409, "Start the lesson first")
    st = load_stats(db, lid, now)
    if st["hearts"] == 0:
        raise HTTPException(409, "No hearts left. Practice to earn one back.")

    seen = db.execute(text(
        "select count(*) from answer_attempts where learner_id=:l and question_id=:q "
        "and created_at >= :s"), {"l": lid, "q": question_id, "s": prog["started_at"]}).scalar_one()
    first_try = seen == 0
    concept = q["concept"] or str(q["lesson_id"])
    gap = ((now - st["last_activity_at"]).total_seconds()
           if st["last_activity_at"] is not None else None)
    suspicious = r.is_suspicious(gap, int(seen))
    correct = check_answer(q["kind"], q["answer"], given)

    combo = prog["combo"] + 1 if correct else 0
    xp = bonus = 0
    if correct and not suspicious:
        xp = r.xp_for_answer(True, first_try)
        bonus = r.combo_bonus(combo, prog["combo_bonus"])
    if not correct:
        st["hearts"] = max(0, st["hearts"] - 1)
        if st["hearts"] == 4:
            st["hearts_updated_at"] = now
    total_xp = xp + bonus
    comeback = (st["last_activity_at"] is not None
                and (now - st["last_activity_at"]).days >= 7)
    st["play_seconds_today"] += r.play_seconds_since(st["last_activity_at"], now)
    st["last_activity_at"] = now
    st["best_combo"] = max(st["best_combo"], combo)
    grant_xp(st, total_xp, now)
    save_stats(db, lid, st)

    db.execute(text(
        "insert into answer_attempts(learner_id, question_id, correct, first_try, channel, "
        "lesson_id, xp, suspicious, chosen) values (:l,:q,:c,:f,'web',:le,:x,:s, "
        "cast(:ch as jsonb))"),
        {"l": lid, "q": question_id, "c": correct, "f": first_try, "le": q["lesson_id"],
         "x": total_xp, "s": suspicious, "ch": json.dumps(given)})
    db.execute(text(
        "update lesson_progress set combo=:c, max_combo=greatest(max_combo,:c), "
        "combo_bonus=combo_bonus+:b, xp_earned=xp_earned+:x, wrong=wrong+:w "
        "where learner_id=:l and lesson_id=:le"),
        {"c": combo, "b": bonus, "x": total_xp, "w": 0 if correct else 1,
         "l": lid, "le": q["lesson_id"]})

    was_due = twin.needs_revision(twin_state(db, lid, concept), now)
    save_twin(db, lid, concept, twin.update(twin_state(db, lid, concept), correct, first_try, now))
    if not correct:
        record_confusion(db, lid, concept, given)

    ctx: dict[str, Any] = {
        "db": db, "lid": lid, "now": now, "correct": correct, "xp": total_xp,
        "counts_for_league": (st["play_seconds_today"] <= r.SOFT_LIMIT_SECONDS
                              and not suspicious and total_xp > 0),
        "combo": combo, "combo_hit": correct and combo > 0 and combo % r.COMBO_STEP == 0,
        "was_due": was_due, "comeback": comeback, "extras": {}, "stats": st}
    hooks.run(hooks.ON_ATTEMPT, ctx)
    save_stats(db, lid, st)
    realtime.publish(lid, {"type": "xp", "xp": total_xp, "total": st["xp"]})
    return {"correct": correct, "first_try": first_try, "feedback":
            "correct" if correct else "not_quite", "correct_answer": q["answer"],
            "xp_gained": total_xp, "combo": combo, "hearts": st["hearts"],
            "suspicious": suspicious, **ctx["extras"]}


def complete_lesson(db: Connection, user_id: str, lesson_id: str,
                    now: datetime | None = None) -> dict[str, Any]:
    now = now or utcnow()
    lid = learner_id_for(db, user_id)
    check_lesson_access(db, user_id, lesson_id)
    prog = db.execute(text(
        "select started_at, status, wrong, completed_at from lesson_progress "
        "where learner_id=:l and lesson_id=:le for update"),
        {"l": lid, "le": lesson_id}).mappings().first()
    if prog is None or prog["status"] != "started":
        raise HTTPException(409, "Start the lesson first")
    total = min(LESSON_SIZE, int(db.execute(text("select count(*) from questions where "
                                                 "lesson_id=:le"), {"le": lesson_id}).scalar_one()))
    done = db.execute(text(
        "select count(distinct question_id) from answer_attempts where learner_id=:l and "
        "lesson_id=:le and correct and created_at >= :s"),
        {"l": lid, "le": lesson_id, "s": prog["started_at"]}).scalar_one()
    if done < total:
        raise HTTPException(409, "Answer every question correctly to finish")
    first_try_ok = db.execute(text(
        "select count(distinct question_id) from answer_attempts where learner_id=:l and "
        "lesson_id=:le and correct and first_try and created_at >= :s"),
        {"l": lid, "le": lesson_id, "s": prog["started_at"]}).scalar_one()
    first_time = prog["completed_at"] is None
    perfect = prog["wrong"] == 0
    st = load_stats(db, lid, now)
    xp = r.XP_LESSON + (r.XP_PERFECT if perfect else 0)
    grant_xp(st, xp, now)
    gems = 0
    if first_time:
        gems = r.GEMS_LESSON
        add_gems(db, lid, gems, "lesson")
        st["lessons_completed"] += 1
        st["perfect_lessons"] += 1 if perfect else 0
    else:                                   # replaying a finished lesson is practice
        st["hearts"] = min(r.MAX_HEARTS, st["hearts"] + 1)
        st["hearts_updated_at"] = now
    db.execute(text(
        "update lesson_progress set status='completed', completed_at=:n, accuracy=:a, "
        "perfect=:p, xp_earned = xp_earned + :x where learner_id=:l and lesson_id=:le"),
        {"n": now, "a": round(first_try_ok / total, 3) if total else 1, "p": perfect,
         "x": xp, "l": lid, "le": lesson_id})
    ctx: dict[str, Any] = {
        "db": db, "lid": lid, "now": now, "xp": xp, "first_time": first_time,
        "perfect": perfect, "counts_for_league": st["play_seconds_today"] <= r.SOFT_LIMIT_SECONDS,
        "lesson_id": lesson_id, "extras": {}, "stats": st, "comeback": False}
    hooks.run(hooks.ON_COMPLETE, ctx)
    save_stats(db, lid, st)
    realtime.publish(lid, {"type": "lesson_complete", "xp": xp})
    return {"xp_gained": xp, "perfect": perfect, "gems_gained": gems, "practice": not first_time,
            "stats": public_stats(db, lid, st, now), **ctx["extras"]}
