"""Custom MCP stdio server: exposes search_health_kb + query_health_graph.

Wraps the existing in-process retrieval (src/rag.py, src/graph_rag.py)
over the MCP wire protocol so the Researcher agent talks to it the same
way it talks to any other MCP server (filesystem, brave-search, etc.).

The retrieval logic itself isn't reimplemented — this is a transport
layer. Run:  uv run python -m mcp_servers.health_kb_server
"""

from __future__ import annotations

import asyncio
import json

import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

from src.graph_rag import search_health_graph
from src.rag import search_health_kb


server = Server("health-kb")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search_health_kb",
            description=(
                "Retrieves authoritative health-guideline chunks from a curated "
                "vector knowledge base (NIH ODS fact sheets, CDC, AHA, USDA, "
                "Mayo Clinic). Returns {text, source_url, title, score} per hit."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "k": {"type": "integer", "default": 5, "minimum": 1, "maximum": 12},
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="query_health_graph",
            description=(
                "Retrieves entities + 1-hop typed relationships from a curated "
                "health knowledge graph (nutrients, conditions, biomarkers, "
                "foods, exercises). Returns entity dicts with edges."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "k": {"type": "integer", "default": 5, "minimum": 1, "maximum": 12},
                },
                "required": ["query"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    query = str(arguments.get("query") or "")
    k = int(arguments.get("k") or 5)

    if name == "search_health_kb":
        chunks = await asyncio.to_thread(search_health_kb, query, k)
        payload = [c.to_dict() for c in chunks]
    elif name == "query_health_graph":
        entities = await asyncio.to_thread(search_health_graph, query, k)
        payload = [e.to_dict() for e in entities]
    else:
        raise ValueError(f"Unknown tool: {name}")

    return [types.TextContent(type="text", text=json.dumps(payload))]


async def main() -> None:
    async with stdio_server() as (read, write):
        await server.run(
            read,
            write,
            InitializationOptions(
                server_name="health-kb",
                server_version="0.1.0",
                capabilities=server.get_capabilities(NotificationOptions(), {}),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
