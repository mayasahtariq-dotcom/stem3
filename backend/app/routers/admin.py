from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import DbDep, require_role
from app.game import engine, leagues
from app.routers.auth import UserOut

router = APIRouter(prefix="/internal", tags=["admin"])


@router.post("/league/reset")
def league_reset(db: DbDep, _: Annotated[UserOut, Depends(require_role("admin"))]) -> dict[str, int]:
    """Weekly promotion and demotion. The scheduler (M12 jobs) calls this logic Monday 00:00 IST."""
    return {"moved": leagues.weekly_reset(db, engine.utcnow())}
