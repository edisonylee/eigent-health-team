"""Curated health knowledge graph + semantic query.

The graph is hand-authored in `data/health_graph.yaml`: nodes are nutrients,
conditions, biomarkers, foods, and exercise classes; edges are typed
relationships (addresses, found_in, measured_by, interacts_with, etc.).

Query path: embed the user's question with the same local sentence-
transformers model used by the vector RAG, cosine-rank against pre-computed
entity-text embeddings, return the top-k entities plus each one's 1-hop
neighborhood. Sub-millisecond traversal in NetworkX — no extra service.

Pairs naturally with `src/rag.py` (vector chunks) and `src/lab_parser.py`
(parsed biomarkers): together they give the Researcher three retrieval
modes — relational graph, source-grounded text, open web.
"""

from __future__ import annotations

import pathlib
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional

import networkx as nx
import numpy as np
import yaml

from .rag import embedder

GRAPH_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "health_graph.yaml"


@dataclass
class Edge:
    predicate: str
    target_id: str
    target_name: str
    target_type: str
    note: Optional[str] = None


@dataclass
class GraphEntity:
    id: str
    type: str
    name: str
    description: str
    aliases: list[str]
    edges: list[Edge]
    score: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "description": self.description,
            "score": round(self.score, 4),
            "edges": [
                {
                    "predicate": e.predicate,
                    "target_id": e.target_id,
                    "target_name": e.target_name,
                    "target_type": e.target_type,
                    "note": e.note,
                }
                for e in self.edges
            ],
        }


def _entity_text(node_attrs: dict) -> str:
    """Text used for embedding — name + aliases + description."""
    parts = [node_attrs.get("name", "")]
    aliases = node_attrs.get("aliases") or []
    if aliases:
        parts.append(", ".join(aliases))
    parts.append(node_attrs.get("description", ""))
    return " — ".join(p for p in parts if p)


@lru_cache(maxsize=1)
def _load() -> tuple[nx.MultiDiGraph, dict[str, np.ndarray], list[str]]:
    """Load the YAML graph and pre-compute entity embeddings.

    Returns (graph, embeddings_by_id, ordered_ids).
    """
    data = yaml.safe_load(GRAPH_FILE.read_text())
    entities = data.get("entities", {}) or {}
    edges = data.get("edges", []) or []

    g: nx.MultiDiGraph = nx.MultiDiGraph()
    for eid, attrs in entities.items():
        g.add_node(
            eid,
            type=attrs.get("type", "entity"),
            name=attrs.get("name", eid),
            aliases=attrs.get("aliases") or [],
            description=attrs.get("description", ""),
        )
    for row in edges:
        if not isinstance(row, list) or len(row) < 3:
            continue
        subj, pred, obj = row[0], row[1], row[2]
        note = row[3] if len(row) > 3 else None
        if subj not in g or obj not in g:
            continue
        g.add_edge(subj, obj, predicate=pred, note=note)

    # Embeddings (one-shot at startup).
    model = embedder()
    ids = list(g.nodes)
    texts = [_entity_text(g.nodes[nid]) for nid in ids]
    vectors = model.encode(texts, normalize_embeddings=True)
    embs: dict[str, np.ndarray] = {ids[i]: vectors[i] for i in range(len(ids))}
    return g, embs, ids


def _node_to_entity(g: nx.MultiDiGraph, node_id: str, score: float) -> GraphEntity:
    attrs = g.nodes[node_id]
    out_edges: list[Edge] = []
    for _, target, edge_attrs in g.out_edges(node_id, data=True):
        t_attrs = g.nodes[target]
        out_edges.append(
            Edge(
                predicate=edge_attrs.get("predicate", "related_to"),
                target_id=target,
                target_name=t_attrs.get("name", target),
                target_type=t_attrs.get("type", "entity"),
                note=edge_attrs.get("note"),
            )
        )
    # Also surface incoming edges (e.g. biomarker measured_by → nutrient).
    for source, _, edge_attrs in g.in_edges(node_id, data=True):
        s_attrs = g.nodes[source]
        out_edges.append(
            Edge(
                predicate=f"←{edge_attrs.get('predicate', 'related_to')}",
                target_id=source,
                target_name=s_attrs.get("name", source),
                target_type=s_attrs.get("type", "entity"),
                note=edge_attrs.get("note"),
            )
        )
    return GraphEntity(
        id=node_id,
        type=attrs.get("type", "entity"),
        name=attrs.get("name", node_id),
        description=attrs.get("description", ""),
        aliases=attrs.get("aliases") or [],
        edges=out_edges,
        score=score,
    )


def search_health_graph(query: str, k: int = 5) -> list[GraphEntity]:
    """Top-k entities by cosine similarity to query, with 1-hop neighborhood.

    Safe-to-fail: returns an empty list on any internal error (graph
    missing, embedder unavailable). The Researcher agent can fall back to
    its other tools.
    """
    if not query or not query.strip():
        return []
    try:
        g, embs, ids = _load()
        q = embedder().encode(query, normalize_embeddings=True)
        scored = sorted(
            ((float(np.dot(q, embs[nid])), nid) for nid in ids),
            key=lambda x: x[0],
            reverse=True,
        )[:k]
        return [_node_to_entity(g, nid, score) for score, nid in scored]
    except Exception:
        return []


def graph_stats() -> dict[str, Any]:
    """Lightweight introspection for `/api/health` style sanity checks."""
    try:
        g, _, _ = _load()
        return {
            "nodes": g.number_of_nodes(),
            "edges": g.number_of_edges(),
            "types": sorted({g.nodes[n].get("type", "?") for n in g.nodes}),
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}
