"""Retrieval over the curated health knowledge base.

Embeddings run **locally** via sentence-transformers (no network, no key),
so user query text never leaves the box for retrieval. The vector store is
a Qdrant instance (default `http://localhost:6333`, brought up via
`docker compose up -d qdrant`).
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from functools import lru_cache
from typing import List

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

COLLECTION = "health_kb"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384  # all-MiniLM-L6-v2 produces 384-dim embeddings
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")


@dataclass
class Chunk:
    """One retrieved passage from the health KB."""

    text: str
    source_url: str
    title: str
    score: float

    def to_dict(self) -> dict:
        return asdict(self)


@lru_cache(maxsize=1)
def embedder() -> SentenceTransformer:
    """Load the local embedding model once. ~25 MB, CPU-friendly."""
    return SentenceTransformer(EMBED_MODEL_NAME)


@lru_cache(maxsize=1)
def qdrant() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL)


def embed(text: str) -> list[float]:
    return embedder().encode(text, normalize_embeddings=True).tolist()


def search_health_kb(query: str, k: int = 5) -> List[Chunk]:
    """Top-k semantically relevant chunks from the curated health KB.

    Returns an empty list if the collection doesn't exist (e.g. before
    ingestion). The Researcher agent calls this; safe-to-fail keeps the
    Workforce running if Qdrant is down or unpopulated.
    """
    try:
        vec = embed(query)
        hits = qdrant().query_points(
            collection_name=COLLECTION,
            query=vec,
            limit=k,
            with_payload=True,
        ).points
    except Exception:
        return []

    out: list[Chunk] = []
    for h in hits:
        payload = h.payload or {}
        out.append(
            Chunk(
                text=str(payload.get("text", "")),
                source_url=str(payload.get("source_url", "")),
                title=str(payload.get("title", "")),
                score=float(h.score or 0.0),
            )
        )
    return out
