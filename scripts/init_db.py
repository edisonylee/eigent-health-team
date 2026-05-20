"""Create the SQLite schema if it doesn't exist.

Run:  uv run python -m scripts.init_db

Idempotent — safe to re-run. The FastAPI lifespan also calls
`backend.db.init_schema` on startup, so manual invocation is only needed
when bootstrapping outside the server (e.g., during CLI evals).
"""

from __future__ import annotations

from backend.db import db_path, init_schema_sync


def main() -> int:
    init_schema_sync()
    print(f"schema initialized at {db_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
