"""Runs a Workforce for the web UI and streams its progress as events.

Each run gets an asyncio.Queue. The Workforce stream callback pushes chunk
events onto it (thread-safe — the callback may fire from a worker thread).
The SSE endpoint in server.py drains the queue.
"""

import asyncio
import re
import time
import uuid
from typing import AsyncIterator, Optional

from camel.tasks import Task

from src.workforce import build_workforce

from .events import ROLES, RunEvent

# task_id -> event queue. `None` on the queue is the close sentinel.
_queues: dict[str, asyncio.Queue] = {}

# Cheap global rate limit — protects the shared OpenAI key behind the gate.
_RUN_TIMES: list[float] = []
_MAX_RUNS_PER_HOUR = 20


def rate_limited() -> bool:
    now = time.time()
    _RUN_TIMES[:] = [t for t in _RUN_TIMES if now - t < 3600]
    if len(_RUN_TIMES) >= _MAX_RUNS_PER_HOUR:
        return True
    _RUN_TIMES.append(now)
    return False


_SUBTASK_MARKER = re.compile(r"-{2,}\s*Subtask\s+\S+\s+Result\s*-{2,}")


def _extract_memo(raw: str) -> str:
    """Pull the clean memo out of a Workforce result.

    The Workforce sometimes returns the final summarizer memo directly, and
    sometimes a concatenation of every subtask result. In the latter case the
    last section is the Summarizer's output — that's the memo we want.
    """
    raw = (raw or "").strip()
    if not raw:
        return "(no memo produced)"
    sections = [s.strip() for s in _SUBTASK_MARKER.split(raw) if s.strip()]
    return sections[-1] if sections else raw


def _role_for(description: str) -> Optional[str]:
    d = description.lower()
    if "research" in d:
        return "researcher"
    if "analyst" in d or "analy" in d:
        return "analyst"
    if "critic" in d:
        return "critic"
    if "summar" in d:
        return "summarizer"
    return None


def start_run(idea: str) -> str:
    """Schedule a Workforce run; return its task_id immediately."""
    task_id = uuid.uuid4().hex[:12]
    _queues[task_id] = asyncio.Queue()
    asyncio.create_task(_run(task_id, idea))
    return task_id


async def _run(task_id: str, idea: str) -> None:
    queue = _queues[task_id]
    loop = asyncio.get_running_loop()

    def emit(event: RunEvent) -> None:
        # Safe from any thread — the stream callback may run off-loop.
        loop.call_soon_threadsafe(queue.put_nowait, event)

    try:
        wf = build_workforce(stream=True)

        id_to_role = {
            child.node_id: _role_for(child.description or "")
            for child in getattr(wf, "_children", [])
        }
        started: set[str] = set()

        def on_chunk(worker_id: str, _task_id: str, text: str, mode: str) -> None:
            role = id_to_role.get(worker_id)
            if role is None:
                return
            if role not in started:
                started.add(role)
                emit(RunEvent(type="worker_running", role=role))
            emit(RunEvent(type="worker_chunk", role=role, text=text, mode=mode))

        wf.set_stream_callback(on_chunk)

        emit(RunEvent(type="task_started"))

        task = Task(
            content=(
                "Produce a structured one-page market memo for this startup "
                "idea. Research it, analyze the market, critique the "
                f"assumptions, and write the final memo.\n\nIdea: {idea}"
            ),
            id="root",
        )

        result = await wf.process_task_async(task)
        emit(RunEvent(type="task_complete", memo=_extract_memo(result.result)))

    except Exception as exc:  # surface failures to the UI instead of hanging
        emit(RunEvent(type="error", text=f"{type(exc).__name__}: {exc}"))
    finally:
        loop.call_soon_threadsafe(queue.put_nowait, None)


async def event_stream(task_id: str) -> AsyncIterator[str]:
    """Yield SSE `data:` payloads for a run until it completes."""
    queue = _queues.get(task_id)
    if queue is None:
        yield RunEvent(type="error", text="unknown task id").model_dump_json()
        return
    try:
        while True:
            event = await queue.get()
            if event is None:
                return
            yield event.model_dump_json()
    finally:
        _queues.pop(task_id, None)
