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
    """A cached clip we can still play (its sound is in the row, or its file is still on disk)."""
    row = db.execute(text("select id, storage_path, data is not null as has_data from audio_cache "
                          "where text_hash=:h and language=:l"), {"h": cache_key(body, rate), "l": lang}).mappings().first()
    if row is None:
        return None
    if row["has_data"]:
        return row["id"]
    try:                                   # older rows: copy the file into the row while it still exists
        wav = storage.read(row["storage_path"])
    except (OSError, ValueError):
        return None                        # file gone (disk wiped): make it again
    db.execute(text("update audio_cache set data=:d where id=:i"), {"d": wav, "i": row["id"]})
    return row["id"]


def store(db: Connection, body: str, lang: str, rate: int, wav: bytes) -> Any:
    path = storage.save(wav, ".wav", folder="audio")
    return db.execute(text(
        "insert into audio_cache(text_hash, language, storage_path, data) values (:h,:l,:p,:d) "
        "on conflict (text_hash, language) do update set storage_path=excluded.storage_path, data=excluded.data "
        "returning id"), {"h": cache_key(body, rate), "l": lang, "p": path, "d": wav}).scalar_one()


def read(db: Connection, audio_id: str) -> bytes | None:
    """The clip's sound, from the row (or the file for rows made before sound was kept in the database)."""
    row = db.execute(text("select storage_path, data from audio_cache where id=cast(:i as uuid)"),
                     {"i": audio_id}).mappings().first()
    if row is None:
        return None
    if row["data"] is not None:
        return bytes(row["data"])
    try:
        return storage.read(row["storage_path"])
    except (OSError, ValueError):
        return None


def get_or_make(db: Connection, body: str, lang: str, rate: int = WEB_RATE) -> Any:
    found = lookup(db, body, lang, rate)
    if found is not None:
        return found
    wav = get_speech(get_settings()).synthesize(body, lang, rate)
    return store(db, body, lang, rate, wav)
