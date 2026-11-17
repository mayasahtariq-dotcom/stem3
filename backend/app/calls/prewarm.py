"""Pre-record call audio when a course is published (PRD: prompts are pre-recorded at publish).

Generates the fixed lines a call will speak for each phone-safe question, in Hindi, Kannada and
English, at 8 kHz. Lines with a name, streak or XP are made live during the call and cached."""
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy import Connection, text

from app.calls.flow import _text, option_choices
from app.calls.script import LINES, UNKNOWN_CALLER, line
from app.config import get_settings
from app.providers import get_speech
from app.speech.cache import CALL_RATE, lookup, store

log = logging.getLogger(__name__)
LANGS = ("hi", "kn", "en")
STATIC = ["consent_yes", "consent_no", "combo", "no_input", "badge", "bye", "no_lesson",
          "closed", "cap", "not_active"]


def lines_for_course(db: Connection, course_id: Any) -> set[tuple[str, str]]:
    want: set[tuple[str, str]] = {(UNKNOWN_CALLER, "en")}
    for lang in LANGS:
        want |= {(line(lang, k), lang) for k in STATIC if k in LINES[lang]}
        want.add((line(lang, "lang_menu"), lang))
        want |= {(line(lang, "repeat", n=n), lang) for n in range(3, 6)}
    qs = db.execute(text(
        "select q.kind, q.prompt, q.options, q.answer from questions q join lessons l on l.id=q.lesson_id "
        "join units u on u.id=l.unit_id where u.course_id=:c and q.call_safe "
        "and q.kind in ('mcq','true_false')"), {"c": course_id}).mappings().all()
    for q in qs:
        for lang in LANGS:
            want.add((_text(q["prompt"], lang), lang))
            choices = option_choices(q, lang)
            for n, (_, label) in enumerate(choices, start=1):
                want.add((line(lang, "option", n=n, text=label), lang))
                want.add((line(lang, "chosen", text=label), lang))
            if q["kind"] == "true_false":
                ans = line(lang, "true" if q["answer"] in (True, "true", "True") else "false")
            else:
                ans = _text(q["answer"], lang)
            want.add((line(lang, "not_quite", answer=ans), lang))
    return {(t, lang) for t, lang in want if t.strip()}


def prewarm_course(db: Connection, course_id: Any, workers: int = 4) -> int:
    """Returns how many new clips were made (cached ones are skipped)."""
    todo = [(t, lang) for t, lang in lines_for_course(db, course_id)
            if lookup(db, t, lang, CALL_RATE) is None]
    if not todo:
        return 0
    speech = get_speech(get_settings())
    made = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = pool.map(lambda tl: (tl, _safe(speech, tl)), todo)
        for (body, lang), wav in results:
            if wav is not None:
                store(db, body, lang, CALL_RATE, wav)
                made += 1
    return made


def _safe(speech: Any, tl: tuple[str, str]) -> bytes | None:
    try:
        return bytes(speech.synthesize(tl[0], tl[1], CALL_RATE))
    except Exception as exc:  # noqa: BLE001 - one bad line must not stop the rest
        log.warning("prewarm line failed: %s", exc)
        return None
