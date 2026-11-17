"""File storage behind a tiny interface: local disk now, Supabase Storage later (PRD)."""
import uuid
from pathlib import Path

from app.config import get_settings


def root() -> Path:
    p = Path(get_settings().upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save(data: bytes, suffix: str, folder: str = "uploads") -> str:
    d = root() / folder
    d.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{suffix}"
    (d / name).write_bytes(data)
    return f"{folder}/{name}"


def read(path: str) -> bytes:
    full = (root() / path).resolve()
    if root().resolve() not in full.parents:
        raise ValueError("bad path")
    return full.read_bytes()
