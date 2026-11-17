"""Parent SMS when a student finishes a whole course (web or phone-call lessons).

Learning data only: course name, XP, streak, badges. Never doubt text. Only to parents linked
to the child (or the parent phone a teacher entered for a call-only student), only with consent,
and never during quiet hours (9 pm to 7 am IST).
"""
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, text

from app.auth.sms import SmsProvider, get_sms
from app.config import get_settings
from app.deps import has_consent
from app.game import engine, hooks
from app.game import rules as r

log = logging.getLogger(__name__)

# Hindi and Kannada are drafts (docs/translations-to-review.md)
MESSAGES = {
    "hi": "आरोह: {name} ने '{course}' कोर्स पूरा कर लिया! कुल {xp} एक्स पी, {streak} दिन की "
          "स्ट्रीक, {badges} बैज। शाबाश!",
    "kn": "ಆರೋಹ: {name} '{course}' ಕೋರ್ಸ್ ಪೂರ್ಣಗೊಳಿಸಿದ್ದಾರೆ! ಒಟ್ಟು {xp} ಎಕ್ಸ್ ಪಿ, {streak} ದಿನಗಳ "
          "ಸ್ಟ್ರೀಕ್, {badges} ಬ್ಯಾಡ್ಜ್‌ಗಳು. ಶಭಾಷ್!",
    "en": "Aaroh: {name} finished the course '{course}'! {xp} XP in total, a {streak}-day "
          "streak and {badges} badges. Well done!",
}


def sms_sender() -> SmsProvider:
    return get_sms()


def is_quiet(now: datetime) -> bool:
    h = now.astimezone(r.IST).hour
    return h >= r.QUIET_START_HOUR or h < r.QUIET_END_HOUR


def parent_phones(db: Connection, lid: Any) -> list[str]:
    rows = db.execute(text(
        "select u.phone_e164 from parent_links p join users u on u.id=p.parent_id "
        "where p.learner_id=:l and u.phone_e164 is not null "
        "union select cs.parent_phone_e164 from learners l join call_students cs "
        "on cs.id=l.call_student_id where l.id=:l and cs.parent_phone_e164 is not null"),
        {"l": lid}).scalars().all()
    return sorted({str(x) for x in rows})


def on_complete(ctx: dict[str, Any]) -> None:
    if not ctx.get("first_time"):
        return
    db: Connection = ctx["db"]
    lid, now = ctx["lid"], ctx["now"]
    course = db.execute(text(
        "select c.id, c.title, "
        "(select count(*) from units u2 join lessons l2 on l2.unit_id=u2.id "
        " where u2.course_id=c.id) as total, "
        "(select count(*) from units u3 join lessons l3 on l3.unit_id=u3.id "
        " join lesson_progress p on p.lesson_id=l3.id and p.learner_id=:l "
        " where u3.course_id=c.id and p.completed_at is not null) as done "
        "from lessons l join units u on u.id=l.unit_id join courses c on c.id=u.course_id "
        "where l.id=:le"), {"l": lid, "le": ctx["lesson_id"]}).mappings().one()
    if course["done"] < course["total"]:
        return
    inserted = db.execute(text(
        "insert into course_completions(learner_id, course_id) values (:l,:c) "
        "on conflict do nothing returning course_id"), {"l": lid, "c": course["id"]}).scalar()
    if inserted is None:
        return                                   # already finished (and texted) before
    status = send_completion_sms(db, lid, course["title"], ctx["stats"], now)
    db.execute(text("update course_completions set sms_status=:s where learner_id=:l and "
                    "course_id=:c"), {"s": status, "l": lid, "c": course["id"]})
    ctx["extras"]["course_completed"] = {"course_id": str(course["id"]), "parent_sms": status}


def send_completion_sms(db: Connection, lid: Any, course: str, st: dict[str, Any],
                        now: datetime) -> str:
    phones = parent_phones(db, lid)
    if not phones:
        return "no_parent"
    if not has_consent(db, lid):
        return "no_consent"
    if get_settings().quiet_hours_enforced and is_quiet(now):
        return "queued_quiet"                    # sent by the scheduler in M12
    who = db.execute(text(
        "select coalesce(u.name, cs.name) as name, coalesce(cs.language, u.language) as lang "
        "from learners l left join users u on u.id=l.user_id "
        "left join call_students cs on cs.id=l.call_student_id where l.id=:l"),
        {"l": lid}).mappings().one()
    badges = db.execute(text("select count(*) from badge_awards where learner_id=:l"),
                        {"l": lid}).scalar_one()
    body = MESSAGES.get(who["lang"], MESSAGES["en"]).format(
        name=who["name"].split()[0], course=course, xp=st["xp"],
        streak=engine.display_streak(st, now), badges=badges)
    sender = sms_sender()
    try:
        for phone in phones:
            sender.send(phone, body)
    except Exception:
        log.exception("parent course SMS failed")
        return "failed"
    db.execute(text("insert into audit_log(action, detail) values ('parent_sms', "
                    "jsonb_build_object('learner_id', cast(:l as text), 'kind', 'course_complete'))"),
               {"l": str(lid)})
    return "sent"


def register() -> None:
    hooks.ON_COMPLETE.append(on_complete)
