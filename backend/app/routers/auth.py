from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.auth import service
from app.auth.sms import SmsProvider, get_sms
from app.auth.tokens import decode_token
from app.config import get_settings
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
DbDep = Annotated[Connection, Depends(get_db)]
SmsDep = Annotated[SmsProvider, Depends(get_sms)]


class OtpRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)
    role: Literal["student", "teacher", "parent"] | None = None
    name: str | None = Field(default=None, max_length=60)
    language: Literal["hi", "kn", "en"] | None = None


class ClassKeyRequest(BaseModel):
    class_key: str = Field(min_length=4, max_length=16)
    name: str = Field(min_length=1, max_length=40)


class UserOut(BaseModel):
    id: str
    role: str
    language: str
    name: str


class SessionOut(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserOut


class OtpSent(BaseModel):
    sent: bool
    dev_code: str | None = None     # only with DEMO_MODE and fake SMS, for local testing


@router.post("/otp", response_model=OtpSent)
def send_otp(body: OtpRequest, request: Request, db: DbDep, sms: SmsDep) -> dict[str, Any]:
    service.rate_limit(f"otp-ip:{request.client.host if request.client else '?'}", 20, 3600)
    code = service.request_otp(db, sms, body.phone)
    s = get_settings()
    return {"sent": True, "dev_code": code if (s.demo_mode and s.use_fake_sms) else None}


@router.post("/verify", response_model=SessionOut)
def verify(body: VerifyRequest, db: DbDep) -> dict[str, Any]:
    return service.verify_otp(db, body.phone, body.code, body.role, body.name, body.language)


@router.post("/class-key", response_model=SessionOut)
def class_key(body: ClassKeyRequest, request: Request, db: DbDep) -> dict[str, Any]:
    service.rate_limit(f"key-ip:{request.client.host if request.client else '?'}", 15, 60)
    return service.class_key_login(db, body.class_key, body.name)


def current_user(db: DbDep, authorization: Annotated[str | None, Header()] = None) -> UserOut:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not signed in")
    try:
        claims = decode_token(authorization.split(" ", 1)[1])
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired token") from exc
    row = db.execute(text("select id, role, language, name from users where id=:i"),
                     {"i": claims["sub"]}).mappings().first()
    if row is None:
        raise HTTPException(401, "Unknown user")
    return UserOut(id=str(row["id"]), role=row["role"], language=row["language"], name=row["name"])


@router.get("/me", response_model=UserOut)
def me(user: Annotated[UserOut, Depends(current_user)]) -> UserOut:
    return user
