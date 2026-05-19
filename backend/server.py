"""FastAPI app: starts Workforce runs, streams progress over SSE, and serves
the built React frontend as a single deployable service.
"""

import os
import pathlib

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.agents import (
    ASSESSOR_PROMPT,
    PLAN_PROMPT,
    RESEARCHER_PROMPT,
    SAFETY_PROMPT,
)

from .runner import event_stream, rate_limited, start_run

# Local dev reads .env; in production (Render) the vars are set directly.
load_dotenv()

APP_PASSWORD = os.environ.get("APP_PASSWORD", "dev")

app = FastAPI(title="Eigent Personalized Health Team")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    idea: str
    password: str


@app.post("/api/run")
async def run(req: RunRequest) -> dict:
    if req.password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Wrong password.")
    if not req.idea.strip():
        raise HTTPException(status_code=400, detail="Idea is empty.")
    if rate_limited():
        raise HTTPException(
            status_code=429, detail="Hourly run limit reached. Try again later."
        )
    return {"task_id": start_run(req.idea.strip())}


@app.get("/api/run/{task_id}/events")
async def events(task_id: str) -> EventSourceResponse:
    return EventSourceResponse(event_stream(task_id))


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/prompts")
def prompts() -> dict:
    """The system prompts for each worker — surfaced in the UI's expand-drawer
    so the user can see exactly what each agent was told to do."""
    return {
        "researcher": RESEARCHER_PROMPT,
        "analyst": ASSESSOR_PROMPT,
        "critic": SAFETY_PROMPT,
        "summarizer": PLAN_PROMPT,
    }


# Serve the built frontend (only present in the Docker image / after a build).
_DIST = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="frontend")
