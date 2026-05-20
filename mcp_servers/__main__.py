"""Default entry: run the health-kb server.

  uv run python -m mcp_servers
"""

import asyncio

from .health_kb_server import main


if __name__ == "__main__":
    asyncio.run(main())
