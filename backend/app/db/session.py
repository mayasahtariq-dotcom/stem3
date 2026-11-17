from collections.abc import Iterator
from functools import lru_cache
from typing import Any

from sqlalchemy import Connection, Engine, create_engine

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def get_db() -> Iterator[Connection]:
    """One connection per request; commits on success, rolls back on error."""
    with get_engine().connect() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


Db = Connection
_ = Any
