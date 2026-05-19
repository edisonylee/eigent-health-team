"""Runs a Workforce for the web UI and streams its progress as events.

Each run gets an asyncio.Queue. Two callbacks push events onto it:
  - the Workforce stream callback (token chunks per worker)
  - each ChatAgent's `on_request_usage` callback (per-request token usage)
A wrapped search tool also emits `tool_call` events when the Researcher hits
the web. All callbacks are thread-safe — they may fire from worker threads.
"""

import asyncio
import functools
import re
import time
import uuid
from collections import defaultdict
from typing import Any, AsyncIterator, Callable, Dict, Optional

from camel.agents import ChatAgent
from camel.societies.workforce import Workforce
from camel.tasks import Task
from camel.toolkits import FunctionTool, SearchToolkit

from src.agents import (
    ASSESSOR_PROMPT,
    PLAN_PROMPT,
    RESEARCHER_PROMPT,
    SAFETY_PROMPT,
    _model,
)

from .events import RunEvent

# task_id -> event queue. `None` on the queue is the close sentinel.
_queues: dict[str, asyncio.Queue] = {}

# Cheap global rate limit — protects the shared OpenAI key behind the gate.
_RUN_TIMES: list[float] = []
_MAX_RUNS_PER_HOUR = 20

# GPT-4o pricing (USD / 1M tokens). Update if rates change.
_INPUT_PER_M = 2.50
_OUTPUT_PER_M = 10.00


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
    if "assess" in d or "analy" in d:
        return "analyst"
    if "safety" in d or "review" in d:
        return "critic"
    if "plan" in d or "writ" in d or "summar" in d:
        return "summarizer"
    return None


def _wrap_search_tool(
    emit: Callable[[RunEvent], None],
) -> FunctionTool:
    """Wrap SearchToolkit.search_duckduckgo to emit a tool_call event per call."""
    real = SearchToolkit().search_duckduckgo

    @functools.wraps(real)
    def search_duckduckgo(*args: Any, **kwargs: Any):
        query = kwargs.get("query", args[0] if args else "")
        emit(
            RunEvent(
                type="tool_call",
                role="researcher",
                tool_name="search_duckduckgo",
                tool_query=str(query),
            )
        )
        return real(*args, **kwargs)

    return FunctionTool(search_duckduckgo)


def _usage_callback(
    role: str,
    totals: Dict[str, Dict[str, int]],
    emit: Callable[[RunEvent], None],
) -> Callable[[Dict[str, Any]], None]:
    """Per-worker on_request_usage hook: accumulate tokens and emit cumulative usage."""

    def cb(payload: Dict[str, Any]) -> None:
        u = payload.get("request_usage", {}) or {}
        bucket = totals[role]
        bucket["prompt_tokens"] += int(u.get("prompt_tokens") or 0)
        bucket["completion_tokens"] += int(u.get("completion_tokens") or 0)
        cost = (
            bucket["prompt_tokens"] * _INPUT_PER_M / 1_000_000
            + bucket["completion_tokens"] * _OUTPUT_PER_M / 1_000_000
        )
        emit(
            RunEvent(
                type="worker_usage",
                role=role,
                prompt_tokens=bucket["prompt_tokens"],
                completion_tokens=bucket["completion_tokens"],
                cost=cost,
            )
        )

    return cb


def _build_instrumented_workforce(
    emit: Callable[[RunEvent], None],
    totals: Dict[str, Dict[str, int]],
) -> Workforce:
    """Build the Workforce with usage callbacks pinned to each worker and a
    tool-call-emitting wrapper around the search tool."""
    search_tool = _wrap_search_tool(emit)

    researcher = ChatAgent(
        system_message=RESEARCHER_PROMPT,
        model=_model(stream=True),
        tools=[search_tool],
        on_request_usage=_usage_callback("researcher", totals, emit),
    )
    assessor = ChatAgent(
        system_message=ASSESSOR_PROMPT,
        model=_model(stream=True),
        on_request_usage=_usage_callback("analyst", totals, emit),
    )
    reviewer = ChatAgent(
        system_message=SAFETY_PROMPT,
        model=_model(stream=True),
        on_request_usage=_usage_callback("critic", totals, emit),
    )
    writer = ChatAgent(
        system_message=PLAN_PROMPT,
        model=_model(stream=True),
        on_request_usage=_usage_callback("summarizer", totals, emit),
    )

    wf = Workforce(
        "Personalized health team — turns a profile into a personalized health plan"
    )
    wf.add_single_agent_worker(
        "Health Researcher — gathers evidence-based, current health information "
        "using web search. Use for any subtask that needs facts from the web.",
        worker=researcher,
    )
    wf.add_single_agent_worker(
        "Health Assessor — analyzes the profile against the research and picks "
        "the highest-impact focus areas. Use for reasoning, not for gathering.",
        worker=assessor,
    )
    wf.add_single_agent_worker(
        "Safety Reviewer — reviews the plan for risks, contraindications, and "
        "red flags, then gives a safety verdict. Use to pressure-test the plan.",
        worker=reviewer,
    )
    wf.add_single_agent_worker(
        "Plan Writer — writes the final personalized health plan in markdown. "
        "Use last, to assemble everything into the deliverable.",
        worker=writer,
    )
    return wf


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
        # Safe from any thread — callbacks may run off-loop.
        loop.call_soon_threadsafe(queue.put_nowait, event)

    try:
        totals: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {"prompt_tokens": 0, "completion_tokens": 0}
        )
        wf = _build_instrumented_workforce(emit, totals)

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
                "Produce a structured personalized health plan for this "
                "person. Research evidence-based guidance, assess their focus "
                "areas, review the plan for safety, and write the final "
                f"plan.\n\nProfile: {idea}"
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
