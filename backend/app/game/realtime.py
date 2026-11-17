"""In-process event hub for WSS /realtime. One API instance; move to Redis/Postgres NOTIFY to scale."""
import asyncio
from collections import defaultdict
from typing import Any

_subs: dict[str, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]]] = (
    defaultdict(set))


def subscribe(learner_id: str) -> tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]:
    sub = (asyncio.get_running_loop(), asyncio.Queue[dict[str, Any]]())
    _subs[learner_id].add(sub)
    return sub


def unsubscribe(learner_id: str,
                sub: tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]) -> None:
    _subs[learner_id].discard(sub)


def publish(learner_id: Any, event: dict[str, Any]) -> None:
    """Safe to call from sync request threads."""
    for loop, q in list(_subs.get(str(learner_id), ())):
        loop.call_soon_threadsafe(q.put_nowait, event)
