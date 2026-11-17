from fastapi import FastAPI

from app.logging_setup import setup_logging

setup_logging()
app = FastAPI(title="Aaroh API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
