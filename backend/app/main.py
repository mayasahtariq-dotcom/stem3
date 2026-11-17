from fastapi import FastAPI

from app.logging_setup import setup_logging
from app.routers import auth

setup_logging()
app = FastAPI(title="Aaroh API", version="0.1.0")
app.include_router(auth.router, prefix="/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
