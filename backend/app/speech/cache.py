"""One cache for all generated speech: web Listen (22.05 kHz) and phone calls (8 kHz)."""
import hashlib
from typing import Any

from sqlalchemy import Connection, text

from app import storage
from app.config import get_settings
from app.providers import get_speech

WEB_RATE = 22050
CALL_RATE = 8000


def cache_key(body: str, rate: int) -> str:
    s = get_settings()
    return hashlib.sha256(f"{s.sarvam_model}|{s.sarvam_speaker}|{rate}|{body}".encode()).hexdigest()


def lookup(db: Connection, body: str, lang: str, rate: int) -> Any | None:
    return db.execute(text("select id from audio_cache where text_hash=:h and language=:l"),
                      {"h": cache_key(body, rate), "l": lang}).scalar()


def store(db: Connection, body: str, lang: str, rate: int, wav: bytes) -> Any:
    path = storage.save(wav, ".wav", folder="audio")
    return db.execute(text(
        "insert into audio_cache(text_hash, language, storage_path) values (:h,:l,:p) "
        "on conflict (text_hash, language) do update set storage_path=excluded.storage_path "
        "returning id"), {"h": cache_key(body, rate), "l": lang, "p": path}).scalar_one()


def get_or_make(db: Connection, body: str, lang: str, rate: int = WEB_RATE) -> Any:
    found = lookup(db, body, lang, rate)
    if found is not None:
        return found
    wav = get_speech(get_settings()).synthesize(body, lang, rate)
    return store(db, body, lang, rate, wav)
