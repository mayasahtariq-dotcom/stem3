from fastapi import FastAPI

from app.game.setup import register_all
from app.logging_setup import setup_logging
from app.routers import admin, auth, calls, game, parent, realtime, student, teacher

setup_logging()
register_all()
app = FastAPI(title="Aaroh API", version="0.1.0")
app.include_router(auth.router, prefix="/v1")
app.include_router(student.router, prefix="/v1")
app.include_router(game.router, prefix="/v1")
app.include_router(teacher.router, prefix="/v1")
app.include_router(parent.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")
app.include_router(realtime.router, prefix="/v1")
app.include_router(calls.router, prefix="/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
