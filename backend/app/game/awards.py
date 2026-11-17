"""Badges, Golu Pots and mascot growth."""
import json
import random
import secrets
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.game import badges, engine, hooks, realtime
from app.game import rules as r
from app.twin import model as twin

OUTFITS = ["bow", "cap", "scarf", "glasses", "medal", "cape"]
STICKERS = ["star", "sun", "leaf", "rainbow", "rocket", "book"]


def snapshot(db: Connection, lid: Any, st: dict[str, Any], now: datetime,
             comeback: bool) -> dict[str, Any]:
    rows = db.execute(text("select concept, mastery, half_life_days, last_seen, next_review from "
                           "twin_concepts where learner_id=:l"), {"l": lid}).mappings().all()
    eff = {x["concept"]: twin.effective_mastery(twin.TwinState(
        x["mastery"], x["half_life_days"], x["last_seen"], x["next_review"]), now) for x in rows}
    return {
        **{k: st[k] for k in ("lessons_completed", "perfect_lessons", "quests_completed",
                              "pots_opened", "best_combo", "xp")},
        "streak": engine.display_streak(st, now), "comeback": comeback,
        "stage": r.mascot_stage(st["xp"]),
        "doubts": db.execute(text("select count(*) from doubts where learner_id=:l"),
                             {"l": lid}).scalar_one(),
        "gems_total": db.execute(text("select coalesce(sum(delta),0) from gems_ledger where "
                                      "learner_id=:l and delta>0"), {"l": lid}).scalar_one(),
        "mastered_concepts": sum(1 for v in eff.values() if v >= 0.9),
        "cell_mastery": eff.get("cell", 0.0)}


def award_badges(ctx: dict[str, Any]) -> None:
    db, lid, now = ctx["db"], ctx["lid"], ctx["now"]
    have = set(db.execute(text("select badge_code from badge_awards where learner_id=:l"),
                          {"l": lid}).scalars().all())
    new = sorted(badges.earned(snapshot(db, lid, ctx["stats"], now, ctx.get("comeback", False)))
                 - have)
    for code in new:
        db.execute(text("insert into badge_awards(learner_id, badge_code) values (:l,:b)"),
                   {"l": lid, "b": code})
        engine.add_gems(db, lid, r.GEMS_BADGE, f"badge:{code}")
        realtime.publish(lid, {"type": "badge", "code": code})
    if new:
        ctx["extras"]["badges"] = new


def on_attempt(ctx: dict[str, Any]) -> None:
    grow_mascot(ctx)
    if ctx.get("combo_hit") or ctx.get("comeback"):
        award_badges(ctx)


def on_complete(ctx: dict[str, Any]) -> None:
    grow_mascot(ctx)
    if ctx["first_time"]:
        pot = ctx["db"].execute(text("insert into pot_opens(learner_id, lesson_id) values "
                                     "(:l,:le) returning id"),
                                {"l": ctx["lid"], "le": ctx["lesson_id"]}).scalar_one()
        ctx["extras"]["pot_id"] = str(pot)
    award_badges(ctx)


def grow_mascot(ctx: dict[str, Any]) -> None:
    db, lid, xp = ctx["db"], ctx["lid"], ctx["stats"]["xp"]
    row = db.execute(text("select stage, outfit from mascot_state where learner_id=:l for update"),
                     {"l": lid}).mappings().one()
    stage = r.mascot_stage(xp)
    outfit = dict(row["outfit"] or {})
    scenes = list(outfit.get("scenes", []))
    if xp >= r.SCENE_XP and "golden_meadow" not in scenes:
        scenes.append("golden_meadow")
    outfit["scenes"] = scenes
    if stage != row["stage"] or outfit != row["outfit"]:
        db.execute(text("update mascot_state set stage=:s, outfit=cast(:o as jsonb) "
                        "where learner_id=:l"), {"s": stage, "o": json.dumps(outfit), "l": lid})
        if stage != row["stage"]:
            realtime.publish(lid, {"type": "mascot", "stage": stage})
            ctx["extras"]["mascot_stage"] = stage


def open_pot(db: Connection, lid: Any, pot_id: str, now: datetime) -> dict[str, Any]:
    """Small, always-positive reward: gems, a sticker or an outfit piece."""
    pot = db.execute(text("select opened_at from pot_opens where id=:p and learner_id=:l "
                          "for update"), {"p": pot_id, "l": lid}).mappings().first()
    if pot is None:
        raise HTTPException(404, "Pot not found")
    if pot["opened_at"] is not None:
        raise HTTPException(409, "This pot is already open")
    mascot = db.execute(text("select outfit from mascot_state where learner_id=:l for update"),
                        {"l": lid}).scalar_one()
    outfit = dict(mascot or {})
    owned, stickers = list(outfit.get("owned", [])), list(outfit.get("stickers", []))
    roll = secrets.randbelow(100)
    reward: dict[str, Any]
    if roll < 60:
        reward = {"type": "gems", "amount": 5 + secrets.randbelow(11)}
    elif roll < 85:
        s = random.SystemRandom().choice(STICKERS)
        reward = {"type": "sticker", "item": s} if s not in stickers else {
            "type": "gems", "amount": 5}
    else:
        o = random.SystemRandom().choice(OUTFITS)
        reward = {"type": "outfit", "item": o} if o not in owned else {"type": "gems", "amount": 8}
    if reward["type"] == "gems":
        engine.add_gems(db, lid, int(reward["amount"]), "pot")
    elif reward["type"] == "sticker":
        stickers.append(reward["item"])
    else:
        owned.append(reward["item"])
    outfit["owned"], outfit["stickers"] = owned, stickers
    db.execute(text("update mascot_state set outfit=cast(:o as jsonb) where learner_id=:l"),
               {"o": json.dumps(outfit), "l": lid})
    db.execute(text("update pot_opens set opened_at=:n, reward=cast(:r as jsonb) where id=:p"),
               {"n": now, "r": json.dumps(reward), "p": pot_id})
    db.execute(text("update student_stats set pots_opened = pots_opened + 1 where learner_id=:l"),
               {"l": lid})
    return reward


def register() -> None:
    hooks.ON_ATTEMPT.append(on_attempt)
    hooks.ON_COMPLETE.append(on_complete)
