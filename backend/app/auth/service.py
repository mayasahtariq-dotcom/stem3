import hashlib
import hmac
import re
import secrets
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from app.auth.sms import SmsProvider
from app.auth.tokens import TTL, issue_token
from app.config import get_settings
from app.people import create_learner

OTP_TTL_MIN = 5
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


def request_otp(db: Connection, sms: SmsProvider, raw_phone: str) -> str:
    phone = normalize_phone(raw_phone)
    sent = db.execute(text("select count(*) from otp_codes where phone_e164=:p "
                           "and created_at > now() - interval '1 hour'"), {"p": phone}).scalar_one()
    if sent >= MAX_SENDS_PER_HOUR:
        raise HTTPException(429, "Too many codes requested. Try again later.")
    code = f"{secrets.randbelow(10**6):06d}"
    db.execute(text("insert into otp_codes(phone_e164, code_hash, expires_at) "
                    "values (:p, :h, now() + make_interval(mins => :m))"),
               {"p": phone, "h": _hash(phone, code), "m": OTP_TTL_MIN})
    sms.send(phone, f"Your Aaroh code is {code}")
    return code


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
    row = db.execute(text(
        "select id, code_hash, attempts, expires_at > now() as live from otp_codes "
        "where phone_e164=:p and not consumed order by created_at desc limit 1 for update"),
        {"p": phone}).mappings().first()
    if row is None or not row["live"]:
        raise HTTPException(400, "Code expired. Ask for a new one.")
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong codes. Ask for a new one.")
    if not hmac.compare_digest(row["code_hash"], _hash(phone, code)):
        db.execute(text("update otp_codes set attempts = attempts + 1 where id=:i"),
                   {"i": row["id"]})
        db.commit()     # keep the attempt count even though we raise
        raise HTTPException(400, "Wrong code")
    db.execute(text("update otp_codes set consumed = true where id=:i"), {"i": row["id"]})
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
