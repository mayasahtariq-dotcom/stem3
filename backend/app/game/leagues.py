"""Weekly class leagues: pods of 10, five tiers, Monday 00:00 IST reset."""
import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import Connection, text

from app.game import hooks, realtime
from app.game import rules as r

TIERS = ["bronze", "silver", "gold", "ruby", "diamond"]
POD_SIZE = 10
PROMOTE = DEMOTE = 3


def eligible_classroom(db: Connection, lid: Any) -> Any | None:
    row = db.execute(text(
        "select c.id, c.league_enabled, coalesce(u.league_opt_out, false) as opt_out "
        "from learners l left join users u on u.id=l.user_id "
        "left join memberships m on m.user_id=l.user_id "
        "left join call_students cs on cs.id=l.call_student_id "
        "join classrooms c on c.id = coalesce(m.classroom_id, cs.classroom_id) "
        "where l.id=:l limit 1"), {"l": lid}).mappings().first()
    if row is None or not row["league_enabled"] or row["opt_out"]:
        return None
    return row["id"]


def pod_for(db: Connection, lid: Any, classroom: Any, tier: str, week: Any) -> Any:
    pod = db.execute(text(
        "select ls.pod_id from league_scores ls join league_pods p on p.id=ls.pod_id "
        "join leagues g on g.id=p.league_id where ls.learner_id=:l and g.week_start=:w limit 1"),
        {"l": lid, "w": week}).scalar()
    if pod:
        return pod
    league = db.execute(text("select id from leagues where classroom_id=:c and tier=:t and "
                             "week_start=:w limit 1"),
                        {"c": classroom, "t": tier, "w": week}).scalar()
    if league is None:
        league = db.execute(text("insert into leagues(classroom_id, tier, week_start) "
                                 "values (:c,:t,:w) returning id"),
                            {"c": classroom, "t": tier, "w": week}).scalar_one()
    pod = db.execute(text(
        "select p.id from league_pods p where p.league_id=:g and "
        "(select count(*) from league_scores s where s.pod_id=p.id) < :n limit 1"),
        {"g": league, "n": POD_SIZE}).scalar()
    if pod is None:
        pod = db.execute(text("insert into league_pods(league_id) values (:g) returning id"),
                         {"g": league}).scalar_one()
    db.execute(text("insert into league_scores(pod_id, learner_id) values (:p,:l)"),
               {"p": pod, "l": lid})
    return pod


def _rank(db: Connection, pod: Any, lid: Any) -> int:
    rows = db.execute(text("select learner_id from league_scores where pod_id=:p "
                           "order by xp desc, learner_id"), {"p": pod}).scalars().all()
    return [str(x) for x in rows].index(str(lid)) + 1


def add_xp(db: Connection, lid: Any, xp: int, tier: str, now: datetime) -> None:
    classroom = eligible_classroom(db, lid)
    if classroom is None or xp <= 0:
        return
    pod = pod_for(db, lid, classroom, tier, r.week_start(r.ist_date(now)))
    before = _rank(db, pod, lid)
    db.execute(text("update league_scores set xp = xp + :x where pod_id=:p and learner_id=:l"),
               {"x": xp, "p": pod, "l": lid})
    after = _rank(db, pod, lid)
    if after < before:
        realtime.publish(lid, {"type": "league_move", "rank": after, "from": before})


def on_xp(ctx: dict[str, Any]) -> None:
    if ctx.get("counts_for_league") and ctx["xp"] > 0:
        add_xp(ctx["db"], ctx["lid"], ctx["xp"], ctx["stats"]["league_tier"], ctx["now"])


def _first_name(name: str, nickname: str | None) -> str:
    return nickname or (name.split()[0] if name.split() else name)


def standings(db: Connection, lid: Any, tier: str, now: datetime) -> dict[str, Any]:
    week = r.week_start(r.ist_date(now))
    pod = db.execute(text(
        "select ls.pod_id from league_scores ls join league_pods p on p.id=ls.pod_id "
        "join leagues g on g.id=p.league_id where ls.learner_id=:l and g.week_start=:w limit 1"),
        {"l": lid, "w": week}).scalar()
    if pod is None:
        return {"enabled": eligible_classroom(db, lid) is not None, "tier": tier, "xp": 0,
                "rank": None, "pod": [], "week_start": str(week)}
    rows = db.execute(text(
        "select ls.learner_id, ls.xp, l.kind, coalesce(u.nickname, u.name, cs.name) as nm, "
        "u.nickname from league_scores ls join learners l on l.id=ls.learner_id "
        "left join users u on u.id=l.user_id left join call_students cs on cs.id=l.call_student_id "
        "where ls.pod_id=:p order by ls.xp desc, ls.learner_id"), {"p": pod}).mappings().all()
    entries = [{"rank": i + 1, "name": _first_name(x["nm"], None), "xp": x["xp"],
                "is_call": x["kind"] == "call", "me": str(x["learner_id"]) == str(lid)}
               for i, x in enumerate(rows)]
    me = next(e for e in entries if e["me"])
    return {"enabled": True, "tier": tier, "xp": me["xp"], "rank": me["rank"],
            "promote_zone": PROMOTE, "demote_zone": DEMOTE, "pod": entries,
            "week_start": str(week)}


def weekly_reset(db: Connection, now: datetime) -> int:
    """Run after Monday 00:00 IST: top 3 of each pod move up, bottom 3 move down."""
    last = r.week_start(r.ist_date(now)) - timedelta(days=7)
    done = db.execute(text("select exists (select 1 from audit_log where action='league_reset' "
                           "and detail->>'week_start' = :w)"), {"w": str(last)}).scalar()
    if done:
        return 0
    moved = 0
    for pod in db.execute(text(
            "select p.id from league_pods p join leagues g on g.id=p.league_id "
            "where g.week_start=:w"), {"w": last}).scalars().all():
        rows = db.execute(text(
            "select ls.learner_id, ls.xp, s.league_tier from league_scores ls "
            "join student_stats s on s.learner_id=ls.learner_id where ls.pod_id=:p "
            "order by ls.xp desc, ls.learner_id"), {"p": pod}).mappings().all()
        n = len(rows)
        for i, x in enumerate(rows):
            idx = TIERS.index(x["league_tier"])
            if i < PROMOTE and x["xp"] > 0:
                idx = min(idx + 1, len(TIERS) - 1)
            elif i >= n - DEMOTE and i >= PROMOTE:
                idx = max(idx - 1, 0)
            if TIERS[idx] != x["league_tier"]:
                db.execute(text("update student_stats set league_tier=:t where learner_id=:l"),
                           {"t": TIERS[idx], "l": x["learner_id"]})
                moved += 1
    db.execute(text("insert into audit_log(action, detail) values ('league_reset', "
                    "cast(:d as jsonb))"), {"d": json.dumps({"week_start": str(last)})})
    return moved


def register() -> None:
    hooks.ON_ATTEMPT.append(on_xp)
    hooks.ON_COMPLETE.append(on_xp)
