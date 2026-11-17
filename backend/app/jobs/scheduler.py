"""The 5-minute scheduler (PRD section 5): calls in each student's window, retries, consent
calls, 'Not reachable', held parent SMS, the Monday league reset and the weekly SMS.

`tick(db, phone, sms, now)` is idempotent: running it twice in the same minute changes nothing."""
import hashlib
import json
import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Connection, text

from app.auth.sms import SmsProvider
from app.calls.flow import consent_on_record, minutes_used_up, within_call_hours
from app.calls.provider import TelephonyProvider
from app.config import get_settings
from app.game import engine, leagues
from app.game import rules as r
from app.notify import is_quiet, send_completion_sms

log = logging.getLogger(__name__)
RETRY_AFTER = timedelta(minutes=20)
MAX_ATTEMPTS = 3              # first call + 2 retries
CONSENT_DAYS = 3
UNREACHABLE_DAYS = 3

WEEKLY = {
    "hi": "आरोह: {name}, तुम्हारी स्ट्रीक {streak} दिन की है, {badges} बैज, क्लास लीग में {rank}। शाबाश!",
    "kn": "ಆರೋಹ: {name}, ನಿನ್ನ ಸ್ಟ್ರೀಕ್ {streak} ದಿನಗಳು, {badges} ಬ್ಯಾಡ್ಜ್‌ಗಳು, ತರಗತಿ ಲೀಗ್‌ನಲ್ಲಿ {rank}. ಶಭಾಷ್!",
    "en": "Aaroh: {name}, your streak is {streak} days, {badges} badges, rank {rank} in your class league. Well done!",
}


def _ist(now: datetime) -> datetime:
    return now.astimezone(r.IST)


def slot_for(cs_id: Any, day: date, start: time, end: time) -> datetime:
    """A random-looking but fixed minute inside the window, different per student and day."""
    total = (datetime.combine(day, end) - datetime.combine(day, start)).seconds // 60
    offset = int(hashlib.sha256(f"{cs_id}|{day}".encode()).hexdigest(), 16) % max(total, 1)
    return datetime.combine(day, start, tzinfo=r.IST) + timedelta(minutes=offset)


def schedule_today(db: Connection, now: datetime) -> int:
    ist = _ist(now)
    today, weekday = ist.date(), ist.isoweekday()
    start_of_day = datetime.combine(today, time(0), tzinfo=r.IST)
    rows = db.execute(text(
        "select cs.id, cs.status, cs.call_days, cs.window_start, cs.window_end, l.id as learner_id, "
        "exists (select 1 from call_sessions s where s.call_student_id=cs.id and s.scheduled_for >= :d "
        " and s.scheduled_for < :e) as has_today, "
        "(select count(distinct (s.scheduled_for at time zone 'Asia/Kolkata')::date) from call_sessions s "
        " where s.call_student_id=cs.id and s.kind='consent' and s.scheduled_for < :d) as consent_days "
        "from call_students cs join learners l on l.call_student_id=cs.id "
        "where cs.status in ('active','not_reachable','waiting_consent')"),
        {"d": start_of_day, "e": start_of_day + timedelta(days=1)}).mappings().all()
    made = 0
    for cs in rows:
        if cs["has_today"] or weekday not in (cs["call_days"] or []):
            continue
        at = slot_for(cs["id"], today, cs["window_start"], cs["window_end"])
        if at < now:                                        # window already started: call soon
            at = now if ist.time() < cs["window_end"] else None  # type: ignore[assignment]
        if at is None:
            continue
        if cs["status"] == "waiting_consent":
            if cs["consent_days"] >= CONSENT_DAYS:
                continue
            kind = "consent"
        elif consent_on_record(db, cs["learner_id"]):
            kind = "lesson"
        else:
            continue
        db.execute(text("insert into call_sessions(call_student_id, scheduled_for, status, kind, learner_id) "
                        "values (:c,:at,'scheduled',:k,:l)"),
                   {"c": cs["id"], "at": at, "k": kind, "l": cs["learner_id"]})
        made += 1
    return made


def retry_missed(db: Connection, now: datetime) -> int:
    ist = _ist(now)
    start_of_day = datetime.combine(ist.date(), time(0), tzinfo=r.IST)
    rows = db.execute(text(
        "select distinct on (s.call_student_id) s.call_student_id, s.kind, s.attempt, s.status, "
        "coalesce(s.ended_at, s.scheduled_for) as ended, s.learner_id, cs.window_end "
        "from call_sessions s join call_students cs on cs.id=s.call_student_id "
        "where s.scheduled_for >= :d and s.scheduled_for < :e "
        "order by s.call_student_id, s.scheduled_for desc, s.attempt desc"),
        {"d": start_of_day, "e": start_of_day + timedelta(days=1)}).mappings().all()
    made = 0
    for s in rows:
        if (s["status"] in ("missed", "failed") and s["attempt"] < MAX_ATTEMPTS
                and s["ended"] + RETRY_AFTER <= now and ist.time() < s["window_end"]):
            db.execute(text("insert into call_sessions(call_student_id, scheduled_for, status, kind, "
                            "learner_id, attempt) values (:c,:n,'scheduled',:k,:l,:a)"),
                       {"c": s["call_student_id"], "n": now, "k": s["kind"], "l": s["learner_id"],
                        "a": s["attempt"] + 1})
            made += 1
    return made


def place_due(db: Connection, phone: TelephonyProvider, now: datetime) -> int:
    if get_settings().call_hours_enforced and not within_call_hours(now):
        return 0
    due = db.execute(text(
        "select s.id, s.kind, cs.id as cs_id, cs.phone_e164, cs.parent_phone_e164, cs.status "
        "from call_sessions s join call_students cs on cs.id=s.call_student_id "
        "where s.status='scheduled' and s.scheduled_for <= :n order by s.scheduled_for"),
        {"n": now}).mappings().all()
    placed = 0
    for s in due:
        if s["status"] in ("paused", "declined") or minutes_used_up(db, s["cs_id"], now):
            db.execute(text("update call_sessions set status='failed' where id=:i"), {"i": s["id"]})
            continue
        to = (s["parent_phone_e164"] or s["phone_e164"]) if s["kind"] == "consent" else s["phone_e164"]
        try:
            pid = phone.place_call(to, str(s["id"]))
        except Exception:
            log.exception("scheduled call failed")
            db.execute(text("update call_sessions set status='failed', ended_at=:n where id=:i"),
                       {"n": now, "i": s["id"]})
            continue
        db.execute(text("update call_sessions set status='ringing', provider_call_id=:p where id=:i"),
                   {"p": pid, "i": s["id"]})
        db.execute(text("insert into call_events(session_id, kind, payload) values (:i,'placed',"
                        "cast(:p as jsonb))"), {"i": s["id"], "p": json.dumps({"kind": s["kind"], "by": "scheduler"})})
        placed += 1
    return placed


def mark_reachability(db: Connection, now: datetime) -> int:
    """'Not reachable' after 3 days of calls with none answered; back to active once one is."""
    since = now - timedelta(days=UNREACHABLE_DAYS)
    changed = db.execute(text(
        "update call_students cs set status='not_reachable' where cs.status='active' "
        "and (select count(distinct (s.scheduled_for at time zone 'Asia/Kolkata')::date) from call_sessions s "
        "     where s.call_student_id=cs.id and s.kind='lesson' and s.scheduled_for >= :since "
        "     and s.status in ('missed','failed')) >= :days "
        "and not exists (select 1 from call_sessions s where s.call_student_id=cs.id "
        "     and s.scheduled_for >= :since and s.status in ('answered','completed'))"),
        {"since": since, "days": UNREACHABLE_DAYS}).rowcount
    back = db.execute(text(
        "update call_students cs set status='active' where cs.status='not_reachable' and exists "
        "(select 1 from call_sessions s where s.call_student_id=cs.id and s.scheduled_for >= :since "
        " and s.status in ('answered','completed'))"), {"since": since}).rowcount
    return int(changed or 0) + int(back or 0)


def flush_quiet_sms(db: Connection, now: datetime) -> int:
    if is_quiet(now):
        return 0
    held = db.execute(text(
        "select cc.learner_id, cc.course_id, c.title from course_completions cc "
        "join courses c on c.id=cc.course_id where cc.sms_status='queued_quiet'")).mappings().all()
    for h in held:
        st = engine.load_stats(db, h["learner_id"], now, lock=False)
        status = send_completion_sms(db, h["learner_id"], h["title"], st, now)
        db.execute(text("update course_completions set sms_status=:s where learner_id=:l and course_id=:c"),
                   {"s": status, "l": h["learner_id"], "c": h["course_id"]})
    return len(held)


def weekly_sms(db: Connection, sms: SmsProvider, now: datetime) -> int:
    """Sunday evening: streak, badges and league rank for students without a screen."""
    ist = _ist(now)
    if ist.isoweekday() != 7 or ist.hour < 18 or is_quiet(now):
        return 0
    week = str(r.week_start(ist.date()))
    rows = db.execute(text(
        "select l.id as lid, cs.name, cs.language, cs.phone_e164 from call_students cs "
        "join learners l on l.call_student_id=cs.id where cs.status='active' and not exists "
        "(select 1 from audit_log a where a.action='weekly_sms' and a.detail->>'week'=:w "
        " and a.detail->>'learner_id'=cast(l.id as text))"), {"w": week}).mappings().all()
    sent = 0
    for x in rows:
        if not consent_on_record(db, x["lid"]):
            continue
        st = engine.load_stats(db, x["lid"], now, lock=False)
        rank = leagues.standings(db, x["lid"], st["league_tier"], now).get("rank") or "-"
        badges = db.execute(text("select count(*) from badge_awards where learner_id=:l"),
                            {"l": x["lid"]}).scalar_one()
        body = WEEKLY.get(x["language"], WEEKLY["en"]).format(
            name=x["name"].split()[0], streak=engine.display_streak(st, now), badges=badges, rank=rank)
        try:
            sms.send(x["phone_e164"], body)
        except Exception:
            log.exception("weekly sms failed")
            continue
        db.execute(text("insert into audit_log(action, detail) values ('weekly_sms', "
                        "cast(:d as jsonb))"), {"d": json.dumps({"week": week, "learner_id": str(x["lid"])})})
        sent += 1
    return sent


def tick(db: Connection, phone: TelephonyProvider, sms: SmsProvider, now: datetime | None = None) -> dict[str, int]:
    now = now or engine.utcnow()
    out = {"scheduled": schedule_today(db, now), "retries": retry_missed(db, now),
           "placed": place_due(db, phone, now), "reachability": mark_reachability(db, now),
           "held_sms": flush_quiet_sms(db, now), "weekly_sms": weekly_sms(db, sms, now),
           "league_moves": leagues.weekly_reset(db, now) if _ist(now).isoweekday() == 1 else 0}
    return out

