"""
OceanMind — FastAPI multi-agent decision engine.

Run:  uvicorn main:app --port 8000
Docs: http://localhost:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env before anything reads os.environ — ingest/service.py and
# ingest/store.py both decide their behaviour at import time.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:  # dotenv is optional; env vars can be set by the shell
    pass

from api.routes import router
from ingest import service as ingest_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Starts the background poller only when INGEST_MODE=live; in golden mode
    # this is a no-op and the app stays fully offline-capable.
    ingest_service.start()
    logger.info("ingestion: %s", ingest_service.status()["mode"])
    yield
    ingest_service.stop()


app = FastAPI(
    lifespan=lifespan,
    title="OceanMind Decision Engine",
    version="2.4.0",
    description=(
        "Causal multi-agent voyage intelligence: Detect → Explain → Simulate "
        "→ Recommend → Approve. Serves the OceanMind frontend at /api/*."
    ),
)

# Hackathon demo: the Vite dev server origin varies — allow everything.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "oceanmind-decision-engine", "version": "2.4.0"}
