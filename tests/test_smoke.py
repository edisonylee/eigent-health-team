"""Backend smoke tests — fast, no API keys required, no model calls.

Catches regressions in the v2 wiring: model_config, SQLite schema, MCP
manager construction, FastAPI app boot.
"""

from __future__ import annotations

import os
import pathlib
import tempfile


def test_model_config_defaults_and_swap():
    from src.model_config import (
        DEFAULT_BACKEND,
        ModelBackend,
        ModelConfig,
        get_active_config,
        set_active_config,
    )

    assert DEFAULT_BACKEND is ModelBackend.OPENAI

    cfg = get_active_config()
    assert cfg.backend is ModelBackend.OPENAI

    # Ollama pricing must be zero — the cost calc relies on it.
    ollama_cfg = ModelConfig(backend=ModelBackend.OLLAMA)
    assert ollama_cfg.input_cost_per_m == 0.0
    assert ollama_cfg.output_cost_per_m == 0.0

    # Hot-swap works.
    set_active_config(ollama_cfg)
    assert get_active_config().backend is ModelBackend.OLLAMA
    # Reset for downstream tests.
    set_active_config(ModelConfig(backend=ModelBackend.OPENAI))


def test_db_schema_init_and_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("HEALTHOS_DATA_DIR", str(tmp_path))
    # Re-import so the module re-reads the env var.
    import importlib

    from backend import db as db_module

    importlib.reload(db_module)
    db_module.init_schema_sync()

    # Profile round-trip
    profile = db_module.upsert_profile_sync({"name": "test", "sex": "F"})
    assert profile["name"] == "test"
    again = db_module.get_profile_sync()
    assert again and again["sex"] == "F"

    # Run + events round-trip
    db_module.create_run_sync("t1", "demo profile", "openai")
    db_module.append_event_sync("t1", "task_started", None, {"type": "task_started"})
    db_module.append_event_sync(
        "t1",
        "human_input_required",
        "researcher",
        {"question": "test?", "request_id": "x"},
    )
    db_module.append_event_sync(
        "t1",
        "human_input_answered",
        "researcher",
        {"request_id": "x", "answer": "ok"},
    )
    db_module.finalize_run_sync("t1", "done", memo="memo", cost_usd=0.01)

    runs = db_module.list_runs_sync()
    assert any(r["task_id"] == "t1" for r in runs)
    tl = db_module.get_timeline_sync("t1")
    kinds = [ev["kind"] for ev in tl]
    assert "human_input_required" in kinds and "human_input_answered" in kinds

    # Settings round-trip
    db_module.set_setting_sync("model.backend", "ollama")
    assert db_module.get_setting_sync("model.backend") == "ollama"

    # Check-ins round-trip
    db_module.add_check_in_sync({"energy": 4, "sleep_hours": 7.0, "mood": 4})
    assert len(db_module.list_check_ins_sync()) == 1


def test_fastapi_app_imports_clean(monkeypatch, tmp_path):
    monkeypatch.setenv("HEALTHOS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    from backend.server import app

    # Every endpoint registered. Sanity-check the new v2 ones.
    routes = {getattr(r, "path", "") for r in app.routes}
    for required in (
        "/api/model/status",
        "/api/model/settings",
        "/api/mcp/servers",
        "/api/runs",
        "/api/runs/{task_id}",
        "/api/runs/{task_id}/timeline",
        "/api/profile",
        "/api/check_ins",
        "/api/data/export",
        "/api/data/wipe",
        "/api/evals",
    ):
        assert required in routes, f"missing route: {required}"


def test_mcp_manager_disabled_state_for_missing_npx_or_brave(monkeypatch, tmp_path):
    """The Brave server must report 'disabled' without BRAVE_API_KEY, even when npx is on PATH."""
    monkeypatch.setenv("HEALTHOS_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)
    from backend.mcp_manager import _resolve_specs

    specs = _resolve_specs()
    by_name = {s.name: s for s in specs}
    assert by_name["brave_search"].params is None
    assert "BRAVE_API_KEY" in (by_name["brave_search"].disabled_reason or "")
