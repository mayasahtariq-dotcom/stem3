"""Natural Sarvam voices on calls. Each spoken line becomes <Play> of a cached 8 kHz clip.

Lines already cached (pre-recorded when a lesson is published) play at once. New lines (name,
streak, XP) are made in parallel within a time budget; anything slow or failing falls back to
Twilio's own voice, so a call never stalls."""
import logging
import re
from concurrent.futures import ThreadPoolExecutor, wait
from contextvars import ContextVar
from typing import Any

from sqlalchemy import Connection

from app.config import get_settings
from app.providers import get_speech
from app.speech.cache import CALL_RATE, lookup, store

log = logging.getLogger(__name__)
BUDGET_SECONDS = 7.0          # Twilio waits about 15 s for a webhook answer
PLACEHOLDER = re.compile(r"\[\[VOICE:(\d+)\]\]")


def enabled() -> bool:
    s = get_settings()
    return (s.call_voice == "sarvam" and not s.use_fake_speech and bool(s.sarvam_api_key)
            and bool(s.public_base_url))


class Voice:
    def __init__(self, db: Connection) -> None:
        self.db = db
        self.lines: list[tuple[str, str, str]] = []      # (text, lang, fallback <Say>)

    def add(self, body: str, lang: str, fallback_xml: str) -> str:
        self.lines.append((body, lang, fallback_xml))
        return f"[[VOICE:{len(self.lines) - 1}]]"

    def finish(self, xml: str) -> str:
        if not self.lines:
            return xml
        ids: dict[int, Any] = {}
        missing: dict[tuple[str, str], list[int]] = {}
        for i, (body, lang, _) in enumerate(self.lines):
            found = lookup(self.db, body, lang, CALL_RATE)
            if found is not None:
                ids[i] = found
            else:
                missing.setdefault((body, lang), []).append(i)
        if missing:
            speech = get_speech(get_settings())
            pool = ThreadPoolExecutor(max_workers=min(6, len(missing)))
            futures = {pool.submit(speech.synthesize, body, lang, CALL_RATE): (body, lang)
                       for body, lang in missing}
            done, late = wait(futures, timeout=BUDGET_SECONDS)
            for f in done:
                body, lang = futures[f]
                if f.exception() is not None:
                    log.warning("sarvam line failed, using Twilio voice: %s", f.exception())
                    continue
                audio_id = store(self.db, body, lang, CALL_RATE, f.result())
                for i in missing[(body, lang)]:
                    ids[i] = audio_id
            if late:
                log.warning("%d sarvam lines too slow, using Twilio voice", len(late))
            pool.shutdown(wait=False, cancel_futures=True)
        base = get_settings().public_base_url.rstrip("/")

        def swap(m: re.Match[str]) -> str:
            i = int(m.group(1))
            return f"<Play>{base}/v1/audio/{ids[i]}</Play>" if i in ids else self.lines[i][2]
        return PLACEHOLDER.sub(swap, xml)


CURRENT: ContextVar[Voice | None] = ContextVar("aaroh_call_voice", default=None)


def with_voice(fn: Any, db: Connection, *args: Any) -> str:
    """Run a call step; when Sarvam voices are on, swap its <Say> lines for <Play> clips."""
    if not enabled():
        return str(fn(db, *args))
    token = CURRENT.set(Voice(db))
    try:
        xml = str(fn(db, *args))
        v = CURRENT.get()
        return v.finish(xml) if v is not None else xml
    finally:
        CURRENT.reset(token)
