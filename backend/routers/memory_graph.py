"""Memory-graph API surface.

Three endpoints under `/api/memory-graph`:

  - GET  /api/memory-graph                       → {nodes, links} for the viz
  - GET  /api/memory-graph/entities/{id}/mentions → entity + chronological mentions
  - POST /api/memory-graph/reindex               → re-run the indexer over SQLite

Mounted from `backend/server.py` via `app.include_router(...)`. Net-new file;
no Phase-C overlap.
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import personal_entities


router = APIRouter(prefix="/api/memory-graph", tags=["memory-graph"])

# Honor the same APP_PASSWORD used by the rest of the API. Read at import
# time + per-request so env changes show up after a restart, same as the
# other endpoints in server.py.
_APP_PASSWORD = os.environ.get("APP_PASSWORD", "dev")


class ReindexRequest(BaseModel):
    password: str
    clear: bool = False


@router.get("")
async def memory_graph(min_mentions: int = 1) -> dict:
    """Return the force-graph payload — nodes + co-mention edges."""
    return await personal_entities.get_graph_data(min_mentions=min_mentions)


@router.get("/entities/{entity_id}/mentions")
async def entity_mentions(entity_id: int, limit: int = 50) -> dict:
    data = await personal_entities.get_entity_mentions(entity_id, limit=limit)
    if data.get("entity") is None:
        raise HTTPException(status_code=404, detail="Entity not found.")
    return data


@router.get("/sources")
async def sources(check_in_limit: int = 60, run_limit: int = 30) -> dict:
    """Return the raw source documents that feed the memory graph.

    Surfaced under the graph viz so the user can see exactly what got
    extracted from — check-ins, run memos, the latest profile note,
    and biomarkers. No LLM call; cheap.
    """
    from .. import db, profile_synthesis as ps

    check_ins = await db.list_check_ins(limit=check_in_limit)
    runs = await db.list_runs(limit=run_limit)
    run_memos = [
        {
            "task_id": r["task_id"],
            "idea": r.get("idea"),
            "memo": r.get("memo"),
            "started_at": r.get("started_at"),
            "ended_at": r.get("ended_at"),
            "status": r.get("status"),
            "mode": r.get("mode") or "plan",
        }
        for r in runs
        if (r.get("memo") or "").strip()
    ]
    profile = await db.get_profile()
    synthesis_meta = ps.get_synthesis_meta_sync()
    biomarkers = ps._recent_biomarkers_sync(limit=60)

    return {
        "check_ins": check_ins,
        "run_memos": run_memos,
        "profile": {
            "notes": (profile or {}).get("notes"),
            **synthesis_meta,
        },
        "biomarkers": biomarkers,
    }


@router.post("/reindex")
async def reindex(req: ReindexRequest) -> dict:
    """Re-extract personal entities from existing SQLite data.

    `clear=True` wipes both tables first — useful when you've changed
    the extractor and want a clean rebuild. Default is additive.
    """
    if req.password != os.environ.get("APP_PASSWORD", _APP_PASSWORD):
        raise HTTPException(status_code=401, detail="Wrong password.")
    if req.clear:
        # Run synchronously — fast, in-process.
        personal_entities.clear_entities_sync()
    counts = await personal_entities.index_existing_data()
    return {"ok": True, "indexed": counts}
