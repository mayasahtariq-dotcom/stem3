import json
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.deps import DbDep, Student, learner_id_for
from app.game import engine
from app.game import rules as r

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/stats")
def stats(db: DbDep, user: Student) -> dict[str, Any]:
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    return engine.public_stats(db, lid, engine.load_stats(db, lid, now, lock=False), now)


@router.post("/freeze")
def buy_freeze(db: DbDep, user: Student) -> dict[str, Any]:
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    st = engine.load_stats(db, lid, now)
    if st["freezes"] >= r.MAX_FREEZES:
        raise HTTPException(409, "You already have two streak freezes")
    if engine.gem_balance(db, lid) < r.FREEZE_COST:
        raise HTTPException(409, "Not enough gems yet")
    engine.add_gems(db, lid, -r.FREEZE_COST, "streak_freeze")
    st["freezes"] += 1
    engine.save_stats(db, lid, st)
    return engine.public_stats(db, lid, st, now)


@router.post("/hearts/refill")
def refill_hearts(db: DbDep, user: Student) -> dict[str, Any]:
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    st = engine.load_stats(db, lid, now)
    if st["hearts"] >= r.MAX_HEARTS:
        raise HTTPException(409, "Hearts are already full")
    if engine.gem_balance(db, lid) < r.HEARTS_REFILL_COST:
        raise HTTPException(409, "Not enough gems yet")
    engine.add_gems(db, lid, -r.HEARTS_REFILL_COST, "hearts_refill")
    st["hearts"], st["hearts_updated_at"] = r.MAX_HEARTS, now
    engine.save_stats(db, lid, st)
    return engine.public_stats(db, lid, st, now)


# ---------- M8: quests, league, badges ----------
@router.get("/quests")
def quests(db: DbDep, user: Student) -> list[dict[str, Any]]:
    from app.game import quests as q
    return q.list_quests(db, learner_id_for(db, user.id), engine.utcnow())


@router.get("/league")
def league(db: DbDep, user: Student) -> dict[str, Any]:
    from app.game import leagues
    now = engine.utcnow()
    lid = learner_id_for(db, user.id)
    st = engine.load_stats(db, lid, now, lock=False)
    return leagues.standings(db, lid, st["league_tier"], now)


@router.get("/badges")
def badges_list(db: DbDep, user: Student) -> list[dict[str, Any]]:
    lid = learner_id_for(db, user.id)
    rows = db.execute(text(
        "select b.code, b.title, a.awarded_at from badges b left join badge_awards a on "
        "a.badge_code=b.code and a.learner_id=:l order by a.awarded_at nulls last, b.code"),
        {"l": lid}).mappings().all()
    return [{"code": x["code"], "title": x["title"], "earned": x["awarded_at"] is not None,
             "awarded_at": x["awarded_at"]} for x in rows]


# ---------- M9: pots, mascot, outfits, settings ----------
class OutfitIn(BaseModel):
    item: str


class SettingsIn(BaseModel):
    daily_goal: Literal[20, 50, 100] | None = None
    league_opt_out: bool | None = None
    nickname: str | None = Field(default=None, max_length=20)


@router.post("/pots/{pot_id}/open")
def open_pot(pot_id: str, db: DbDep, user: Student) -> dict[str, Any]:
    from app.game import awards
    lid = learner_id_for(db, user.id)
    reward = awards.open_pot(db, lid, pot_id, engine.utcnow())
    return {"reward": reward, "gems": engine.gem_balance(db, lid)}


@router.get("/mascot")
def mascot(db: DbDep, user: Student) -> dict[str, Any]:
    lid = learner_id_for(db, user.id)
    row = db.execute(text("select stage, outfit from mascot_state where learner_id=:l"),
                     {"l": lid}).mappings().one()
    xp = db.execute(text("select xp from student_stats where learner_id=:l"),
                    {"l": lid}).scalar_one()
    nxt = next((t for t in (r.STAGE_COW_XP, r.STAGE_CHAMPION_XP, r.SCENE_XP) if xp < t), None)
    return {"stage": row["stage"], "outfit": row["outfit"], "xp": xp, "next_unlock_at_xp": nxt}


@router.post("/outfits/buy")
def buy_outfit(body: OutfitIn, db: DbDep, user: Student) -> dict[str, Any]:
    from app.game.awards import OUTFITS
    lid = learner_id_for(db, user.id)
    if body.item not in OUTFITS:
        raise HTTPException(404, "Unknown outfit")
    outfit = dict(db.execute(text("select outfit from mascot_state where learner_id=:l for update"),
                             {"l": lid}).scalar_one() or {})
    owned = list(outfit.get("owned", []))
    if body.item in owned:
        raise HTTPException(409, "You already have this one")
    if engine.gem_balance(db, lid) < r.OUTFIT_COST:
        raise HTTPException(409, "Not enough gems yet")
    engine.add_gems(db, lid, -r.OUTFIT_COST, f"outfit:{body.item}")
    outfit["owned"] = [*owned, body.item]
    db.execute(text("update mascot_state set outfit=cast(:o as jsonb) where learner_id=:l"),
               {"o": json.dumps(outfit), "l": lid})
    return {"owned": outfit["owned"], "gems": engine.gem_balance(db, lid)}


@router.patch("/settings")
def settings(body: SettingsIn, db: DbDep, user: Student) -> dict[str, bool]:
    lid = learner_id_for(db, user.id)
    if body.daily_goal is not None:
        db.execute(text("update student_stats set daily_goal=:g where learner_id=:l"),
                   {"g": body.daily_goal, "l": lid})
    if body.league_opt_out is not None:
        db.execute(text("update users set league_opt_out=:v where id=:u"),
                   {"v": body.league_opt_out, "u": user.id})
    if body.nickname is not None:
        db.execute(text("update users set nickname=:n where id=:u"),
                   {"n": body.nickname.strip() or None, "u": user.id})
    return {"ok": True}
