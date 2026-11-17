import hashlib
import hmac
import logging
import re
import secrets
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.auth.sms import SmsProvider, get_code_service
from app.auth.tokens import TTL, issue_token
from app.config import get_settings
from app.people import create_learner

OTP_TTL_MIN = 5
DEMO_FALLBACK_CODE = "123456"
log = logging.getLogger(__name__)
MAX_ATTEMPTS = 5
MAX_SENDS_PER_HOUR = 5
E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(key: str, limit: int, window_s: int) -> None:
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many tries. Please wait and try again.")
    q.append(now)


def normalize_phone(raw: str) -> str:
    p = re.sub(r"[\s-]", "", raw)
    if re.fullmatch(r"\d{10}", p):
        p = "+91" + p
    if not E164.fullmatch(p):
        raise HTTPException(422, "Enter a valid phone number")
    return p


def _hash(phone: str, code: str) -> str:
    key = get_settings().supabase_jwt_secret.encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


VERIFY_MARK = "twilio-verify"   # otp_codes.code_hash when Twilio Verify holds the code
VERIFY_TTL_MIN = 10             # Twilio Verify codes live 10 minutes


def request_otp(db: Connection, sms: SmsProvider, raw_phone: str, locale: str = "en") -> str:
    """Sends a login code. Returns the code we made, or "" when Twilio Verify sent (and holds) it."""
    phone = normalize_phone(raw_phone)
    sent = db.execute(text("select count(*) from otp_codes where phone_e164=:p "
                           "and created_at > now() - interval '1 hour'"), {"p": phone}).scalar_one()
    if sent >= MAX_SENDS_PER_HOUR:
        raise HTTPException(429, {"code": "RATE_LIMITED", "message": "Too many codes requested. Try again later."})
    codes = get_code_service()
    code, mark, ttl = f"{secrets.randbelow(10**6):06d}", None, OTP_TTL_MIN
    try:
        if codes is not None:
            codes.start(phone, locale)
            code, mark, ttl = "", VERIFY_MARK, VERIFY_TTL_MIN
        else:
            sms.send(phone, f"Your Aaroh code is {code}")
    except Exception as exc:
        log.warning("OTP SMS failed: %s", exc)
        if not get_settings().demo_mode:
            raise HTTPException(503, {"code": "SMS_UNAVAILABLE",
                                      "message": "We could not send the code. Try again later."}) from exc
        code, mark, ttl = DEMO_FALLBACK_CODE, None, OTP_TTL_MIN   # demo only: a failed text falls back to a known code
    db.execute(text("insert into otp_codes(phone_e164, code_hash, expires_at) "
                    "values (:p, :h, now() + make_interval(mins => :m))"),
               {"p": phone, "h": mark or _hash(phone, code), "m": ttl})
    return code


def check_otp(db: Connection, phone: str, code: str) -> None:
    """Checks a login code for an already-normalized phone and uses it up; raises 400/429 otherwise."""
    row = db.execute(text(
        "select id, code_hash, attempts, expires_at > now() as live from otp_codes "
        "where phone_e164=:p and not consumed order by created_at desc limit 1 for update"),
        {"p": phone}).mappings().first()
    if row is None or not row["live"]:
        raise HTTPException(400, {"code": "OTP_EXPIRED", "message": "Code expired. Ask for a new one."})
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(429, {"code": "RATE_LIMITED", "message": "Too many wrong codes. Ask for a new one."})
    code = re.sub(r"\s", "", code)
    if row["code_hash"] == VERIFY_MARK:
        codes = get_code_service()
        if codes is None:
            raise HTTPException(503, {"code": "SMS_UNAVAILABLE", "message": "Login codes are not set up."})
        try:
            ok = bool(re.fullmatch(r"\d{4,10}", code)) and codes.check(phone, code)
        except Exception as exc:
            log.warning("OTP check failed: %s", exc)
            raise HTTPException(503, {"code": "SMS_UNAVAILABLE",
                                      "message": "We could not check the code. Try again."}) from exc
    else:
        ok = hmac.compare_digest(row["code_hash"], _hash(phone, code))
    if not ok:
        db.execute(text("update otp_codes set attempts = attempts + 1 where id=:i"), {"i": row["id"]})
        db.commit()     # keep the attempt count even though we raise
        raise HTTPException(400, {"code": "INVALID_CODE", "message": "Wrong code"})
    db.execute(text("update otp_codes set consumed = true where id=:i"), {"i": row["id"]})


def _session(user: dict[str, Any]) -> dict[str, Any]:
    return {"access_token": issue_token(user["id"], user["role"]), "token_type": "bearer",
            "expires_in": TTL,
            "user": {"id": str(user["id"]), "role": user["role"],
                     "language": user["language"], "name": user["name"]}}


def _create_user(db: Connection, role: str, name: str, language: str,
                 phone: str | None) -> dict[str, Any]:
    row = db.execute(text("insert into users(role, name, language, phone_e164) "
                          "values (:r,:n,:l,:p) returning id, role, name, language"),
                     {"r": role, "n": name, "l": language, "p": phone}).mappings().one()
    if role == "student":
        create_learner(db, user_id=row["id"])
    return dict(row)


def verify_otp(db: Connection, raw_phone: str, code: str, role: str | None,
               name: str | None, language: str | None) -> dict[str, Any]:
    phone = normalize_phone(raw_phone)
    check_otp(db, phone, code)
    found = db.execute(text("select id, role, name, language from users where phone_e164=:p"),
                       {"p": phone}).mappings().first()
    if found is not None:
        return _session(dict(found))
    if role is None or not name:
        raise HTTPException(422, "New account: role and name are required")
    return _session(_create_user(db, role, name.strip(), language or "hi", phone))


def class_key_login(db: Connection, class_key: str, name: str) -> dict[str, Any]:
    name = name.strip()
    classroom = db.execute(text("select id from classrooms where class_key=:k"),
                           {"k": class_key.strip().upper()}).mappings().first()
    if classroom is None:
        raise HTTPException(404, "Class key not found")
    found = db.execute(text(
        "select u.id, u.role, u.name, u.language from users u "
        "join memberships m on m.user_id = u.id "
        "where m.classroom_id=:c and u.phone_e164 is null and lower(u.name)=lower(:n)"),
        {"c": classroom["id"], "n": name}).mappings().first()
    if found is not None:
        return _session(dict(found))
    created = _create_user(db, "student", name, "hi", None)
    db.execute(text("insert into memberships values (:c, :u)"),
               {"c": classroom["id"], "u": created["id"]})
    return _session(created)
