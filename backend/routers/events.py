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


# Match server.py:_password_ok exactly — when APP_PASSWORD is unset
# (the desktop / local default) auth is disabled. The old `_password()`
# helper defaulted to the literal "dev", which 401'd every event POST
# from a local frontend (which sends an empty string when no gate is up).
def _password_ok(provided: Optional[str]) -> bool:
    expected = os.environ.get("APP_PASSWORD", "")
    if not expected:
        return True
    return provided == expected


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
    if not _password_ok(req.password):
        raise HTTPException(status_code=401, detail="Wrong password.")
    if req.category not in CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{req.category}'. Allowed: {sorted(CATEGORIES)}",
        )
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description is empty.")
    row = await db.add_event(
        {
            "profile_id": req.profile_id,
            "category": req.category,
            "description": req.description.strip(),
            "day": req.day,
            "tags": req.tags,
            "meta": req.meta,
        }
    )
    # Feed the event's prose into the memory graph + profile synthesis so a
    # quick-note actually makes the agents smarter — not just the calendar.
    import threading
    from .. import personal_entities as _pe, profile_synthesis as _ps

    def _bg() -> None:
        try:
            text = f"[{row['category']}] {row['description']}"
            _pe.index_text_sync(text, "event_note", str(row["id"]))
            # If the event carries a scalar (sleep hours, mood score, symptom
            # severity), bucket it as an observation so it joins the graph.
            _pe.index_event_observation_sync(int(row["id"]))
        except Exception:
            pass

    threading.Thread(target=_bg, daemon=True).start()
    _ps.spawn_profile_synthesis()
    return row


@router.delete("/{event_id}")
async def delete_event(event_id: int, req: DeleteEventRequest) -> dict:
    if not _password_ok(req.password):
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
