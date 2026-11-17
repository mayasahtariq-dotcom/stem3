"""Quests: 3 daily, 1 weekly, plus a Twin-chosen revision quest with double gems."""
from datetime import date, datetime
from typing import Any

from sqlalchemy import Connection, text

from app.game import engine, hooks, realtime
from app.game import rules as r
from app.twin import model as twin


def period_start(kind: str, now: datetime) -> date:
    today = r.ist_date(now)
    return r.week_start(today) if kind == "weekly" else today


def bump(ctx: dict[str, Any], event: str, amount: int = 1) -> None:
    db: Connection = ctx["db"]
    now: datetime = ctx["now"]
    lid = ctx["lid"]
    for q in db.execute(text("select id, kind, code, target, gems from quests where event=:e"),
                        {"e": event}).mappings().all():
        row = db.execute(text(
            "insert into quest_progress(learner_id, quest_id, period_start, progress) "
            "values (:l,:q,:p,:a) on conflict (learner_id, quest_id, period_start) do update "
            "set progress = quest_progress.progress + :a "
            "returning progress, completed"),
            {"l": lid, "q": q["id"], "p": period_start(q["kind"], now), "a": amount}
        ).mappings().one()
        if row["progress"] >= q["target"] and not row["completed"]:
            db.execute(text("update quest_progress set completed=true where learner_id=:l and "
                            "quest_id=:q and period_start=:p"),
                       {"l": lid, "q": q["id"], "p": period_start(q["kind"], now)})
            engine.add_gems(db, lid, q["gems"], f"quest:{q['code']}")
            ctx["stats"]["quests_completed"] += 1
            ctx["extras"].setdefault("quests_completed", []).append(q["code"])
            realtime.publish(lid, {"type": "quest_done", "code": q["code"], "gems": q["gems"]})
        else:
            realtime.publish(lid, {"type": "quest_tick", "code": q["code"],
                                   "progress": row["progress"], "target": q["target"]})


def on_attempt(ctx: dict[str, Any]) -> None:
    bump(ctx, "answer")
    if ctx["combo_hit"]:
        bump(ctx, "combo")
    if ctx["correct"] and ctx["was_due"]:
        bump(ctx, "revision")


def on_complete(ctx: dict[str, Any]) -> None:
    bump(ctx, "lesson")


def revision_candidates(db: Connection, lid: Any, now: datetime) -> list[str]:
    rows = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review "
                           "from twin_concepts where learner_id=:l"), {"l": lid}).mappings().all()
    return [x["concept"] for x in rows if twin.needs_revision(twin.TwinState(
        x["mastery"], x["half_life_days"], x["last_seen"], x["next_review"]), now)]


def list_quests(db: Connection, lid: Any, now: datetime) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select q.code, q.kind, q.target, q.gems, q.event, "
        "coalesce(p.progress,0) as progress, coalesce(p.completed,false) as completed "
        "from quests q left join quest_progress p on p.quest_id=q.id and p.learner_id=:l and "
        "p.period_start = case when q.kind='weekly' then :w else :d end order by q.kind, q.code"),
        {"l": lid, "w": r.week_start(r.ist_date(now)), "d": r.ist_date(now)}).mappings().all()
    due = revision_candidates(db, lid, now)
    out = []
    for x in rows:
        if x["kind"] == "revision" and not due and x["progress"] == 0:
            continue
        item = {k: x[k] for k in ("code", "kind", "target", "gems", "progress", "completed")}
        if x["kind"] == "revision":
            item["concepts"] = due[:5]
        out.append(item)
    return out


def register() -> None:
    hooks.ON_ATTEMPT.append(on_attempt)
    hooks.ON_COMPLETE.append(on_complete)
