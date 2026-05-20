"""PyInstaller entry point for the bundled backend.

Two roles, dispatched by env var so PyInstaller can ship ONE binary:
  - default: boot uvicorn against backend.server:app
  - HEALTHOS_MCP_MODE=health_kb: pivot to the health_kb MCP stdio server
    (so MCPManager can spawn it via `sys.executable` when frozen, since
    `<binary> -m mcp_servers.health_kb_server` isn't a thing).
"""

from __future__ import annotations

import asyncio
import os
import sys


def main() -> int:
    # When frozen, sys.frozen is set by PyInstaller.
    if getattr(sys, "frozen", False):
        bundle_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        os.chdir(bundle_dir)

    mode = os.environ.get("HEALTHOS_MCP_MODE")
    if mode == "health_kb":
        from mcp_servers.health_kb_server import main as mcp_main

        asyncio.run(mcp_main())
        return 0

    import uvicorn

    port = int(os.environ.get("HEALTHOS_PORT", "8765"))
    uvicorn.run(
        "backend.server:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
