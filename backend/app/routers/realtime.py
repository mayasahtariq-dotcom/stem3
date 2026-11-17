import asyncio
from typing import Any

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from app.auth.tokens import decode_token
from app.db.session import get_engine
from app.game import realtime

router = APIRouter(tags=["realtime"])


def lookup_learner(user_id: str) -> str | None:
    """Short-lived DB lookup so a socket never holds a connection open."""
    with get_engine().connect() as conn:
        lid = conn.execute(text("select id from learners where user_id=:u"),
                           {"u": user_id}).scalar()
    return str(lid) if lid else None


@router.websocket("/realtime")
async def realtime_ws(websocket: WebSocket, token: str = "") -> None:
    """Live XP pops, quest ticks, league movement. Auth by ?token= (browsers cannot set headers)."""
    try:
        claims: dict[str, Any] = decode_token(token)
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return
    lid = await run_in_threadpool(lookup_learner, claims["sub"])
    if lid is None:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    sub = realtime.subscribe(lid)
    try:
        while True:
            await websocket.send_json(await sub[1].get())
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        realtime.unsubscribe(lid, sub)
