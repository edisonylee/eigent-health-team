"""Retrieval over the curated health knowledge base.

Embeddings run **locally** via sentence-transformers (no network, no key),
so user query text never leaves the box for retrieval. The vector store is
**embedded Chroma** — no Docker daemon required. Storage lives in
`~/.healthos/vector/` (override via `HEALTHOS_VECTOR_DIR`).

A pre-built KB snapshot can be shipped at `data/health_kb_chroma/`;
first launch copies it to the user data dir so the app is usable
out of the box without re-running the Firecrawl ingest pipeline.
"""

from __future__ import annotations

import os
import pathlib
import shutil
import threading
from dataclasses import asdict, dataclass
from functools import lru_cache
from typing import List

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

COLLECTION = "health_kb"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384


@dataclass
class Chunk:
    text: str
    source_url: str
    title: str
    score: float

    def to_dict(self) -> dict:
        return asdict(self)


def _vector_dir() -> pathlib.Path:
    p = pathlib.Path(
        os.environ.get("HEALTHOS_VECTOR_DIR")
        or (pathlib.Path.home() / ".healthos" / "vector")
    ).expanduser()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _bundled_seed() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent / "data" / "health_kb_chroma"


def _maybe_seed_from_bundle(target: pathlib.Path) -> None:
    """Copy a shipped Chroma snapshot into the user data dir on first run.

    No-op if the user already has data, or if no bundle is shipped. This is
    what makes the desktop build usable without running Firecrawl.
    """
    if any(target.iterdir()):
        return
    seed = _bundled_seed()
    if not seed.is_dir():
        return
    try:
        for child in seed.iterdir():
            dest = target / child.name
            if child.is_dir():
                shutil.copytree(child, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(child, dest)
    except Exception:
        # Seeding is best-effort — if it fails, the app still works against
        # an empty KB (Researcher gracefully degrades to graph + web).
        pass


# PyTorch's MPS (Apple Metal) backend is NOT thread-safe — its shader
# pipeline cache corrupts under concurrent access and segfaults the whole
# process (SIGSEGV in MetalShaderLibrary::getLibraryPipelineState). We embed
# from multiple daemon threads (entity extraction, profile synthesis) and
# in-process during Workforce runs, so pin to CPU and serialize encode calls.
# CPU inference for a 384-dim MiniLM over a handful of chunks is sub-second.
_embed_lock = threading.Lock()


@lru_cache(maxsize=1)
def embedder() -> SentenceTransformer:
    return SentenceTransformer(EMBED_MODEL_NAME, device="cpu")


@lru_cache(maxsize=1)
def chroma() -> chromadb.Client:
    vdir = _vector_dir()
    _maybe_seed_from_bundle(vdir)
    return chromadb.PersistentClient(
        path=str(vdir),
        settings=Settings(anonymized_telemetry=False, allow_reset=False),
    )


def _collection():
    return chroma().get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def embed(text: str) -> list[float]:
    with _embed_lock:
        return embedder().encode(text, normalize_embeddings=True).tolist()


def search_health_kb(query: str, k: int = 5) -> List[Chunk]:
    """Top-k semantically relevant chunks from the curated health KB.

    Returns an empty list on any failure (collection missing, store
    corrupted, etc). Safe-to-fail keeps the Workforce running.
    """
    try:
        vec = embed(query)
        coll = _collection()
        if coll.count() == 0:
            return []
        result = coll.query(
            query_embeddings=[vec],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    out: list[Chunk] = []
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]
    for doc, meta, dist in zip(docs, metas, dists):
        meta = meta or {}
        # cosine distance ∈ [0, 2]; convert to similarity score in [-1, 1].
        score = max(0.0, 1.0 - float(dist or 0.0))
        out.append(
            Chunk(
                text=str(doc or ""),
                source_url=str(meta.get("source_url", "")),
                title=str(meta.get("title", "")),
                score=score,
            )
        )
    return out
