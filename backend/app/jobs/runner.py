"""Runs the scheduler tick every few minutes inside the API process (SCHEDULER_ENABLED=true).

One API instance only; for several instances move this to a Procrastinate job (PRD) so ticks
don't overlap. Each tick uses its own connection and commits on success."""
import asyncio
import logging
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.auth.sms import get_sms
from app.config import get_settings
from app.db.session import get_engine
from app.jobs.scheduler import tick
from app.providers import get_telephony

log = logging.getLogger(__name__)


def run_once() -> dict[str, Any]:
    s = get_settings()
    with get_engine().begin() as conn:
        out = tick(conn, get_telephony(s), get_sms())
    log.info("scheduler tick %s", out)
    return out


async def loop(interval: int) -> None:
    while True:
        try:
            await run_in_threadpool(run_once)
        except Exception:
            log.exception("scheduler tick failed")
        await asyncio.sleep(interval)
