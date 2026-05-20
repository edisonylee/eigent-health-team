"""Model backend configuration — OpenAI (default) and Ollama (opt-in).

Default matches Eigent's actual OOB behavior: cloud first (OpenAI), local
opt-in. The fully-local-capable story is preserved — flip to Ollama in
Settings and the same Workforce runs against a local model with cost=0.

A2 (SQLite persistence) layers durable settings on top of this module by
hot-swapping the active config from the `setting` table on startup.
"""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from enum import Enum
from typing import Optional
from urllib.parse import urlparse

from camel.models import ModelFactory
from camel.types import ModelPlatformType


class ModelBackend(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"


# Per-backend pricing (USD per 1M tokens). Ollama is free (local).
_PRICING: dict[ModelBackend, tuple[float, float]] = {
    ModelBackend.OPENAI: (2.50, 10.00),
    ModelBackend.OLLAMA: (0.0, 0.0),
}


DEFAULT_BACKEND = ModelBackend.OPENAI
DEFAULT_OPENAI_MODEL = "gpt-4o"
DEFAULT_OLLAMA_MODEL = "llama3.1:8b"
DEFAULT_OLLAMA_HOST = "http://localhost:11434/v1"


@dataclass
class ModelConfig:
    backend: ModelBackend = DEFAULT_BACKEND
    openai_model: str = DEFAULT_OPENAI_MODEL
    ollama_model: str = DEFAULT_OLLAMA_MODEL
    ollama_host: str = DEFAULT_OLLAMA_HOST

    @property
    def input_cost_per_m(self) -> float:
        return _PRICING[self.backend][0]

    @property
    def output_cost_per_m(self) -> float:
        return _PRICING[self.backend][1]

    @property
    def active_model(self) -> str:
        return self.openai_model if self.backend is ModelBackend.OPENAI else self.ollama_model

    @classmethod
    def from_env(cls) -> "ModelConfig":
        raw = os.environ.get("MODEL_BACKEND", "").lower().strip()
        try:
            backend = ModelBackend(raw) if raw else DEFAULT_BACKEND
        except ValueError:
            backend = DEFAULT_BACKEND
        return cls(
            backend=backend,
            openai_model=os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
            ollama_model=os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
            ollama_host=os.environ.get("OLLAMA_HOST", DEFAULT_OLLAMA_HOST),
        )


_active: Optional[ModelConfig] = None


def get_active_config() -> ModelConfig:
    global _active
    if _active is None:
        _active = ModelConfig.from_env()
    return _active


def set_active_config(config: ModelConfig) -> None:
    """Hot-swap the active config. The next agent created picks it up."""
    global _active
    _active = config


def build_model(stream: bool = False, *, temperature: float = 0.2):
    """Create a CAMEL model backend for the currently active config.

    stream=True enables token streaming so the Workforce stream callback
    emits incremental chunks (used by the web UI). CLI usage leaves it False.

    `stream_options.include_usage=True` is required to receive token usage
    in streaming responses — otherwise on_request_usage fires with zeros
    and the live cost ticker stays at $0.
    """
    cfg = get_active_config()
    model_config_dict: dict = {"temperature": temperature, "stream": stream}
    if stream:
        model_config_dict["stream_options"] = {"include_usage": True}

    if cfg.backend is ModelBackend.OPENAI:
        return ModelFactory.create(
            model_platform=ModelPlatformType.OPENAI,
            model_type=cfg.openai_model,
            model_config_dict=model_config_dict,
        )

    return ModelFactory.create(
        model_platform=ModelPlatformType.OLLAMA,
        model_type=cfg.ollama_model,
        url=cfg.ollama_host,
        model_config_dict=model_config_dict,
    )


def probe_status() -> dict:
    """Lightweight backend probe for GET /api/model/status. Non-blocking."""
    cfg = get_active_config()
    openai_key_set = bool(os.environ.get("OPENAI_API_KEY"))

    ollama_reachable = False
    try:
        u = urlparse(cfg.ollama_host)
        host = u.hostname or "localhost"
        port = u.port or 11434
        with socket.create_connection((host, port), timeout=0.5):
            ollama_reachable = True
    except Exception:
        ollama_reachable = False

    return {
        "backend": cfg.backend.value,
        "model": cfg.active_model,
        "openai_model": cfg.openai_model,
        "ollama_model": cfg.ollama_model,
        "ollama_host": cfg.ollama_host,
        "available_backends": [b.value for b in ModelBackend],
        "openai_key_set": openai_key_set,
        "ollama_reachable": ollama_reachable,
        "has_usable_backend": (
            (cfg.backend is ModelBackend.OPENAI and openai_key_set)
            or (cfg.backend is ModelBackend.OLLAMA and ollama_reachable)
        ),
    }
