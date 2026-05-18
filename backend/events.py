from typing import Literal, Optional

from pydantic import BaseModel

EventType = Literal[
    "task_started",
    "worker_running",
    "worker_chunk",
    "task_complete",
    "error",
]

# The four roles, in pipeline order. Used by both the runner and the frontend.
ROLES = ["researcher", "analyst", "critic", "summarizer"]


class RunEvent(BaseModel):
    """One server-sent event in a run's lifecycle.

    Mirrors the typed step events an Eigent-style frontend consumes: a type,
    the role it concerns, and a payload (incremental text, or the final memo).
    """

    type: EventType
    role: Optional[str] = None
    text: str = ""
    mode: Optional[str] = None  # "delta" or "accumulate", for worker_chunk
    memo: Optional[str] = None
