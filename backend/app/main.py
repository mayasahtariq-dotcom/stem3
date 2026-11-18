import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.game.setup import register_all
from app.jobs.runner import loop as scheduler_loop
from app.logging_setup import setup_logging
from app.routers import (
    admin,
    ai,
    auth,
    calls,
    demo,
    game,
    learning,
    parent,
    realtime,
    student,
    teacher,
    web_compat,
    web_compat_b,
    web_sim,
)

setup_logging()
register_all()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    from app import titles
    from app.db.session import get_engine
    titles.refresh_if_stale(get_engine())      # translated course titles into memory
    task = None
    if get_settings().scheduler_enabled:       # the PRD's 5-minute job
        task = asyncio.create_task(scheduler_loop(get_settings().scheduler_interval))
    yield
    if task:
        task.cancel()


app = FastAPI(title="Aaroh API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().web_origins.split(",") if o.strip()],
    # Vercel production + preview deploys (https://<anything>.vercel.app)
    allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app",
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "Accept", "X-Channel"],
    allow_credentials=False,          # bearer tokens, no cookies
)
app.include_router(auth.router, prefix="/v1")
app.include_router(student.router, prefix="/v1")
app.include_router(learning.router, prefix="/v1")
app.include_router(ai.router, prefix="/v1")
app.include_router(game.router, prefix="/v1")
app.include_router(teacher.router, prefix="/v1")
app.include_router(parent.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")
app.include_router(realtime.router, prefix="/v1")
app.include_router(calls.router, prefix="/v1")
app.include_router(demo.router, prefix="/v1")
app.include_router(demo.page)
app.include_router(web_compat.router)
app.include_router(web_compat_b.router)
app.include_router(web_sim.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.middleware("http")
async def keep_titles_fresh(request, call_next):  # type: ignore[no-untyped-def]
    """Reload translated titles every couple of minutes (other processes may add some)."""
    from app import titles
    from app.db.session import get_engine
    titles.refresh_if_stale(get_engine())
    return await call_next(request)
