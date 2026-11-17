import time
import uuid
from typing import Any

import jwt

from app.config import get_settings

TTL = 3600


def issue_token(user_id: uuid.UUID | str, role: str) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "role": "authenticated", "app_role": role,
               "aud": "authenticated", "iat": now, "exp": now + TTL}
    return jwt.encode(payload, get_settings().supabase_jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, get_settings().supabase_jwt_secret, algorithms=["HS256"],
                      audience="authenticated")
