"""Build the health knowledge base.

Pipeline: URLs in data/kb_sources.txt  →  Firecrawl  →  markdown  →  chunks
(≈500 tokens)  →  local sentence-transformers embeddings  →  Qdrant upsert.

Run:  uv run python -m scripts.ingest_kb [--limit N] [--force]

Requires:
  - QDRANT_URL (default http://localhost:6333)  — `docker compose up -d qdrant`
  - FIRECRAWL_API_KEY in .env                    — free tier from firecrawl.dev
"""

from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import re
import sys
import time
import uuid
from typing import Iterable, Optional

import tiktoken
from dotenv import load_dotenv
from qdrant_client.models import Distance, PointStruct, VectorParams

from src.rag import COLLECTION, EMBED_DIM, embed, qdrant


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES_FILE = REPO_ROOT / "data" / "kb_sources.txt"
CHUNK_TARGET_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50


def read_sources(path: pathlib.Path) -> list[str]:
    urls: list[str] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    return urls


def firecrawl_scrape(url: str) -> tuple[str, str]:
    """Return (title, markdown). Caller handles transport errors."""
    from firecrawl import Firecrawl  # firecrawl-py v4+

    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise RuntimeError(
            "FIRECRAWL_API_KEY not set. Add it to .env "
            "(free tier from firecrawl.dev)."
        )

    client = Firecrawl(api_key=api_key)
    doc = client.scrape(url, formats=["markdown"])

    md = getattr(doc, "markdown", "") or ""
    meta = getattr(doc, "metadata", None)
    title: Optional[str] = None
    if meta is not None:
        title = (
            meta.get("title") if isinstance(meta, dict) else getattr(meta, "title", None)
        )
    return str(title or url), str(md)


# -- chunking ----------------------------------------------------------------

_TOK = tiktoken.get_encoding("cl100k_base")


def _toklen(s: str) -> int:
    return len(_TOK.encode(s))


def chunk_markdown(md: str) -> list[str]:
    """Paragraph-greedy chunker. Walks paragraphs, fills until ~target tokens.

    Adds a small overlap by carrying the last paragraph into the next chunk
    so concepts that bridge paragraphs survive a chunk boundary.
    """
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    if not md:
        return []

    paragraphs = [p.strip() for p in md.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    buf_tokens = 0

    for p in paragraphs:
        p_tok = _toklen(p)
        # Oversized paragraph: hard-split on sentences as a fallback.
        if p_tok > CHUNK_TARGET_TOKENS:
            if buf:
                chunks.append("\n\n".join(buf))
                buf, buf_tokens = [], 0
            for piece in _split_long(p, CHUNK_TARGET_TOKENS):
                chunks.append(piece)
            continue

        if buf_tokens + p_tok > CHUNK_TARGET_TOKENS and buf:
            chunks.append("\n\n".join(buf))
            # overlap: carry the last paragraph forward
            if _toklen(buf[-1]) <= CHUNK_OVERLAP_TOKENS:
                buf = [buf[-1]]
                buf_tokens = _toklen(buf[-1])
            else:
                buf, buf_tokens = [], 0

        buf.append(p)
        buf_tokens += p_tok

    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def _split_long(text: str, target: int) -> Iterable[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    buf: list[str] = []
    bt = 0
    for s in sentences:
        st = _toklen(s)
        if bt + st > target and buf:
            yield " ".join(buf)
            buf, bt = [], 0
        buf.append(s)
        bt += st
    if buf:
        yield " ".join(buf)


# -- ids ---------------------------------------------------------------------

def chunk_id(url: str, idx: int) -> str:
    digest = hashlib.sha1(f"{url}::{idx}".encode()).digest()
    return str(uuid.UUID(bytes=digest[:16]))


# -- main --------------------------------------------------------------------

def ensure_collection() -> None:
    client = qdrant()
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )
        print(f"created collection '{COLLECTION}' (dim={EMBED_DIM})")


def existing_urls() -> set[str]:
    """All source URLs already represented in the collection."""
    client = qdrant()
    urls: set[str] = set()
    offset = None
    try:
        while True:
            page, offset = client.scroll(
                collection_name=COLLECTION,
                with_payload=["source_url"],
                limit=512,
                offset=offset,
            )
            for p in page:
                u = (p.payload or {}).get("source_url")
                if u:
                    urls.add(u)
            if offset is None:
                break
    except Exception:
        pass
    return urls


def ingest_one(url: str) -> int:
    """Scrape, chunk, embed, upsert. Returns chunk count."""
    title, md = firecrawl_scrape(url)
    if not md:
        print(f"  ! no markdown returned, skipping")
        return 0
    chunks = chunk_markdown(md)
    if not chunks:
        return 0
    points = [
        PointStruct(
            id=chunk_id(url, i),
            vector=embed(c),
            payload={
                "text": c,
                "source_url": url,
                "title": title,
                "chunk_index": i,
            },
        )
        for i, c in enumerate(chunks)
    ]
    qdrant().upsert(collection_name=COLLECTION, points=points)
    return len(points)


def main(argv: Optional[list[str]] = None) -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="ingest at most N URLs")
    ap.add_argument("--force", action="store_true", help="re-ingest URLs already in KB")
    args = ap.parse_args(argv)

    if not SOURCES_FILE.exists():
        print(f"missing {SOURCES_FILE}", file=sys.stderr)
        return 2

    urls = read_sources(SOURCES_FILE)
    if args.limit:
        urls = urls[: args.limit]

    ensure_collection()
    seen = set() if args.force else existing_urls()

    total_chunks = 0
    ok = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for i, url in enumerate(urls, 1):
        if url in seen:
            skipped += 1
            print(f"[{i}/{len(urls)}] · already indexed: {url}")
            continue
        print(f"[{i}/{len(urls)}] · {url}")
        try:
            n = ingest_one(url)
            total_chunks += n
            ok += 1
            print(f"    → {n} chunks")
        except Exception as exc:
            failed.append((url, f"{type(exc).__name__}: {exc}"))
            print(f"    ! {type(exc).__name__}: {exc}")
        time.sleep(0.2)  # gentle on Firecrawl

    points = qdrant().count(COLLECTION, exact=True).count
    print()
    print(f"=== summary ===")
    print(f"sources processed: {ok}  skipped: {skipped}  failed: {len(failed)}")
    print(f"chunks added this run: {total_chunks}")
    print(f"collection '{COLLECTION}' total points: {points}")
    if failed:
        print("\nfailures:")
        for u, e in failed:
            print(f"  {u}  —  {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
