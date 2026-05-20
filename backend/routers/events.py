"""Events API — the calendar substrate for the long-term operator.

  - GET    /api/events?since&until&category   → list of events
  - POST   /api/events                         → log an event (retroactive ok)
  - DELETE /api/events/{id}                    → remove an event
  - GET    /api/events/category-counts?since&until
                                               → per-(day, category) counts
                                                  for the trend chart

`since` / `until` are YYYY-MM-DD strings in user-local time. Net-new
router; mounted from `server.py` with one `include_router` call.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db


router = APIRouter(prefix="/api/events", tags=["events"])


# Same APP_PASSWORD pattern as the other routes; resolved per-request so
# env overrides take effect on next call.
def _password() -> str:
    return os.environ.get("APP_PASSWORD", "dev")


CATEGORIES = {
    "symptom",
    "meal",
    "sleep",
    "exercise",
    "supplement",
    "medication",
    "mood",
    "note",
}


class LogEventRequest(BaseModel):
    password: str
    category: str
    description: str
    day: Optional[str] = None  # YYYY-MM-DD; omit for "today"
    tags: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
    profile_id: Optional[int] = None


class DeleteEventRequest(BaseModel):
    password: str


@router.get("")
async def list_events(
    since: Optional[str] = None,
    until: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 500,
) -> dict:
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
    events = await db.list_events(since=since, until=until, category=category, limit=limit)
    return {"events": events}


@router.post("")
async def log_event(req: LogEventRequest) -> dict:
    if req.password != _password():
        raise HTTPException(status_code=401, detail="Wrong password.")
    if req.category not in CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{req.category}'. Allowed: {sorted(CATEGORIES)}",
        )
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description is empty.")
    return await db.add_event(
        {
            "profile_id": req.profile_id,
            "category": req.category,
            "description": req.description.strip(),
            "day": req.day,
            "tags": req.tags,
            "meta": req.meta,
        }
    )


@router.delete("/{event_id}")
async def delete_event(event_id: int, req: DeleteEventRequest) -> dict:
    if req.password != _password():
        raise HTTPException(status_code=401, detail="Wrong password.")
    ok = await db.delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found.")
    return {"ok": True}


@router.get("/category-counts")
async def category_counts(
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> dict:
    rows = await db.event_category_counts(since=since, until=until)
    return {"counts": rows}


@router.get("/categories")
def list_categories() -> dict:
    return {"categories": sorted(CATEGORIES)}
