"""Spawns + holds stdio sessions to configured MCP servers.

Lifecycle hooks into the FastAPI lifespan. Each server is a child process
the manager owns. `call_sync` is a thread-safe bridge for the runner's
worker threads (which call FunctionTools synchronously while the asyncio
loop runs on the main thread).

Three configured servers (only `health_kb` is required):
  - health_kb     — custom, wraps src/rag.py + src/graph_rag.py
  - filesystem    — official @modelcontextprotocol/server-filesystem
  - brave_search  — opt-in, requires BRAVE_API_KEY
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import shutil
import sys
from dataclasses import dataclass, field
from typing import Any, Optional

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


# --- server configuration -----------------------------------------------------


@dataclass
class _ServerSpec:
    """How to spawn a server, plus enable/disable state."""

    name: str
    params: Optional[StdioServerParameters]
    disabled_reason: Optional[str] = None  # if non-None, don't spawn


def _notes_dir() -> pathlib.Path:
    p = pathlib.Path(
        os.environ.get("HEALTHOS_NOTES_DIR")
        or (pathlib.Path.home() / ".healthos" / "notes")
    ).expanduser()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _resolve_specs() -> list[_ServerSpec]:
    specs: list[_ServerSpec] = []

    # 1. health_kb — our custom server. Always-on.
    # When running unfrozen, we spawn it via `python -m`. When frozen by
    # PyInstaller (Electron build), sys.executable is the bundle binary,
    # which dispatches the MCP-server entry point via HEALTHOS_MCP_MODE.
    if getattr(sys, "frozen", False):
        health_kb_params = StdioServerParameters(
            command=sys.executable,
            args=[],
            env={**os.environ, "HEALTHOS_MCP_MODE": "health_kb"},
        )
    else:
        health_kb_params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "mcp_servers.health_kb_server"],
            env={**os.environ},
        )
    specs.append(_ServerSpec(name="health_kb", params=health_kb_params))

    # 2. filesystem — official. Needs `npx`.
    npx = shutil.which("npx")
    if npx:
        specs.append(
            _ServerSpec(
                name="filesystem",
                params=StdioServerParameters(
                    command=npx,
                    args=[
                        "-y",
                        "@modelcontextprotocol/server-filesystem",
                        str(_notes_dir()),
                    ],
                    env={**os.environ},
                ),
            )
        )
    else:
        specs.append(
            _ServerSpec(
                name="filesystem",
                params=None,
                disabled_reason="npx not found on PATH",
            )
        )

    # 3. brave_search — opt-in; needs BRAVE_API_KEY. Cloud, not local.
    brave_key = os.environ.get("BRAVE_API_KEY")
    if brave_key and npx:
        specs.append(
            _ServerSpec(
                name="brave_search",
                params=StdioServerParameters(
                    command=npx,
                    args=["-y", "@modelcontextprotocol/server-brave-search"],
                    env={**os.environ, "BRAVE_API_KEY": brave_key},
                ),
            )
        )
    else:
        specs.append(
            _ServerSpec(
                name="brave_search",
                params=None,
                disabled_reason=(
                    "BRAVE_API_KEY not set" if npx else "npx not found on PATH"
                ),
            )
        )

    return specs


# --- client ------------------------------------------------------------------


@dataclass
class _MCPClient:
    name: str
    params: StdioServerParameters
    status: str = "pending"  # pending | connected | degraded
    error: Optional[str] = None
    tools: list[dict] = field(default_factory=list)
    _session: Optional[ClientSession] = None
    _ready: asyncio.Event = field(default_factory=asyncio.Event)
    _stop: asyncio.Event = field(default_factory=asyncio.Event)
    _task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())
        try:
            await asyncio.wait_for(self._ready.wait(), timeout=15)
        except asyncio.TimeoutError:
            self.status = "degraded"
            self.error = "startup timed out after 15s"

    async def _run(self) -> None:
        try:
            async with stdio_client(self.params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    self._session = session
                    tools_result = await session.list_tools()
                    self.tools = [
                        {"name": t.name, "description": t.description or ""}
                        for t in tools_result.tools
                    ]
                    self.status = "connected"
                    self._ready.set()
                    await self._stop.wait()
        except Exception as exc:
            self.status = "degraded"
            self.error = f"{type(exc).__name__}: {exc}"
            self._ready.set()

    async def call(self, tool_name: str, arguments: dict) -> Any:
        if self.status != "connected" or self._session is None:
            raise RuntimeError(f"MCP server '{self.name}' not connected ({self.status})")
        return await self._session.call_tool(tool_name, arguments)

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass


# --- manager -----------------------------------------------------------------


class MCPManager:
    def __init__(self) -> None:
        self._clients: dict[str, _MCPClient] = {}
        self._disabled: dict[str, str] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def startup(self) -> None:
        self._loop = asyncio.get_running_loop()
        for spec in _resolve_specs():
            if spec.params is None:
                self._disabled[spec.name] = spec.disabled_reason or "disabled"
                continue
            client = _MCPClient(name=spec.name, params=spec.params)
            self._clients[spec.name] = client
            try:
                await client.start()
            except Exception as exc:
                client.status = "degraded"
                client.error = str(exc)

    async def shutdown(self) -> None:
        for c in list(self._clients.values()):
            await c.stop()
        self._clients.clear()

    def status(self) -> list[dict]:
        out: list[dict] = []
        for c in self._clients.values():
            out.append(
                {
                    "name": c.name,
                    "status": c.status,
                    "error": c.error,
                    "tools": c.tools,
                }
            )
        for name, reason in self._disabled.items():
            out.append(
                {
                    "name": name,
                    "status": "disabled",
                    "error": reason,
                    "tools": [],
                }
            )
        return out

    def is_connected(self, server_name: str) -> bool:
        c = self._clients.get(server_name)
        return c is not None and c.status == "connected"

    def call_sync(self, server_name: str, tool_name: str, arguments: dict) -> Any:
        """Call an MCP tool from a worker thread.

        Agents invoke FunctionTools synchronously while the asyncio loop runs
        on the main thread. We dispatch back to the loop and block this
        thread until the result is ready.
        """
        client = self._clients.get(server_name)
        if client is None:
            raise RuntimeError(f"unknown MCP server: {server_name}")
        if self._loop is None:
            raise RuntimeError("MCPManager not started")
        future = asyncio.run_coroutine_threadsafe(
            client.call(tool_name, arguments), self._loop
        )
        return future.result(timeout=60)

    async def reconnect(self, server_name: str) -> None:
        c = self._clients.get(server_name)
        if c is None:
            raise KeyError(server_name)
        await c.stop()
        new = _MCPClient(name=c.name, params=c.params)
        self._clients[server_name] = new
        await new.start()


# Module-level singleton wired by the FastAPI lifespan.
_manager: Optional[MCPManager] = None


def get_manager() -> MCPManager:
    global _manager
    if _manager is None:
        _manager = MCPManager()
    return _manager


def reset_manager_for_tests() -> None:
    global _manager
    _manager = None
