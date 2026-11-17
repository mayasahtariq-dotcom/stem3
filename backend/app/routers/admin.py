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


@router.post("/scheduler/tick")
def scheduler_tick(_: Annotated[UserOut, Depends(require_role("admin"))]) -> dict[str, int]:
    """Run one scheduler tick now (normally every 5 minutes)."""
    from app.jobs.runner import run_once
    return run_once()
