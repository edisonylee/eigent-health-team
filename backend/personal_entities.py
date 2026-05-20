"""Personal entity extraction + memory-graph data.

Distinct from the canonical health graph in `data/health_graph.yaml`:
canonical nodes (vitamin_d, magnesium, t2_diabetes_risk, ...) are the
same for every user. *Personal* entities are user-specific — doctors,
gyms, family members, trips, the specific supplements the user is
actually on — extracted from the user's own data: plan memos, check-in
notes, the profile note, and lab biomarker names.

Each personal entity optionally links to a canonical node via
`canonical_id` when the extraction matches a canonical name or alias.
That lets the memory-graph viz overlay user history onto the canonical
knowledge graph.

Two-phase extraction:
  1. Rule-based pass: match against canonical graph names + aliases.
     High precision; cheap; no LLM call.
  2. LLM pass: open-set types (provider, person, place, activity)
     that the canonical graph doesn't know about, via a typed Pydantic
     response_format.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

from pydantic import BaseModel, Field

from camel.agents import ChatAgent

from src.graph_rag import _load as _load_graph
from src.model_config import build_model

from .db import _connect


# ---------- Schemas ----------

class ExtractedEntity(BaseModel):
    name: str = Field(
        description="Canonical surface form, e.g. 'Vitamin D', 'Dr. Smith'."
    )
    type: str = Field(
        description=(
            "One of: nutrient | condition | provider | medication | food | "
            "place | person | activity | other."
        )
    )


class EntityExtraction(BaseModel):
    entities: list[ExtractedEntity]


# ---------- Canonical index (cached once) ----------

_canonical_cache: Optional[dict[str, tuple[str, str, str]]] = None


def _canonical_index() -> dict[str, tuple[str, str, str]]:
    """Map lowercase name/alias → (canonical_id, canonical_type, display_name)."""
    global _canonical_cache
    if _canonical_cache is not None:
        return _canonical_cache
    try:
        g, _, _ = _load_graph()
    except Exception:
        return {}
    idx: dict[str, tuple[str, str, str]] = {}
    for nid in g.nodes:
        attrs = g.nodes[nid]
        display = attrs.get("name") or nid
        ctype = attrs.get("type", "entity")
        terms = [display] + (attrs.get("aliases") or [])
        for term in terms:
            if not term:
                continue
            key = term.lower()
            # First write wins (so the primary name dominates over aliases)
            idx.setdefault(key, (nid, ctype, display))
    _canonical_cache = idx
    return idx


# ---------- LLM extraction ----------

_EXTRACTOR_PROMPT = """You extract real-world entities from text in a
personal health journal. Categories:

  - nutrient    — vitamins, minerals, supplements (Vitamin D, magnesium, fish oil)
  - condition   — health conditions or symptoms named (back pain, T2 diabetes)
  - provider    — doctors, clinics, dietitians, therapists (Dr. Smith, the cardiologist)
  - medication  — prescription drugs by name
  - food        — specific foods or food groups emphasized
  - place       — gyms, workplaces, trips, locations
  - person      — non-provider people mentioned (partner, parent, friend)
  - activity    — exercise types, hobbies (running, yoga, cycling)
  - other       — important entities outside the above

Rules:
  - Extract only entities ACTUALLY MENTIONED. Don't infer.
  - Use canonical surface forms ("Vitamin D", not "vit d").
  - Skip generic ambient words ("water", "food", "sleep") unless used as a named entity.
  - For non-named people use a descriptor ("my partner").
  - Return strictly the typed EntityExtraction schema.
"""


def _extractor_agent() -> ChatAgent:
    return ChatAgent(
        system_message=_EXTRACTOR_PROMPT,
        model=build_model(stream=False, temperature=0.0),
    )


def _llm_extract(text: str) -> list[ExtractedEntity]:
    if not text or not text.strip():
        return []
    if len(text) > 8000:
        text = text[:8000]
    agent = _extractor_agent()
    try:
        resp = agent.step(
            f"Extract entities from this text:\n\n---\n{text}\n---",
            response_format=EntityExtraction,
        )
    except Exception:
        return []
    msg = resp.msgs[0]
    parsed = getattr(msg, "parsed", None)
    if isinstance(parsed, EntityExtraction):
        return parsed.entities
    try:
        return EntityExtraction.model_validate_json(msg.content).entities
    except Exception:
        return []


# ---------- Combined extraction ----------

def extract_entities(text: str) -> list[dict]:
    """Return list of {name, type, canonical_id} for entities in `text`.

    Phase 1: canonical-graph alias matching (rule-based).
    Phase 2: LLM extraction for open-set categories.

    Phase 1 results dominate on duplicates so canonical links are preserved.
    """
    if not text or not text.strip():
        return []

    found: dict[tuple[str, str], dict] = {}  # (name_lower, type) → record

    # Phase 1: canonical
    text_lower = text.lower()
    for term, (canonical_id, canonical_type, display) in _canonical_index().items():
        # Only match whole-word-ish presence to avoid "iron" matching "iron-ic".
        if _term_in_text(term, text_lower):
            key = (display.lower(), canonical_type)
            if key not in found:
                found[key] = {
                    "name": display,
                    "type": canonical_type,
                    "canonical_id": canonical_id,
                }

    # Phase 2: LLM
    for ent in _llm_extract(text):
        key = (ent.name.lower(), ent.type)
        if key in found:
            continue
        # Late canonical link attempt
        cid = _canonical_index().get(ent.name.lower())
        canonical_id = cid[0] if cid else None
        found[key] = {
            "name": ent.name,
            "type": ent.type,
            "canonical_id": canonical_id,
        }

    return list(found.values())


def _term_in_text(term: str, text_lower: str) -> bool:
    """Lightweight whole-token presence check. Avoids short-substring noise."""
    if len(term) < 4:
        # For short terms, require word boundaries (cheap heuristic)
        import re
        return re.search(rf"\b{re.escape(term)}\b", text_lower) is not None
    return term in text_lower


# ---------- Persistence ----------

def _upsert_entity_sync(name: str, type_: str, canonical_id: Optional[str]) -> int:
    now = time.time()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, canonical_id FROM personal_entity WHERE name = ? AND type = ?",
            (name, type_),
        ).fetchone()
        if row:
            eid = row["id"]
            conn.execute(
                "UPDATE personal_entity SET last_seen = ?, mention_count = mention_count + 1, "
                "canonical_id = COALESCE(canonical_id, ?) WHERE id = ?",
                (now, canonical_id, eid),
            )
        else:
            cur = conn.execute(
                "INSERT INTO personal_entity"
                "(name, type, canonical_id, first_seen, last_seen, mention_count) "
                "VALUES(?, ?, ?, ?, ?, 1)",
                (name, type_, canonical_id, now, now),
            )
            eid = cur.lastrowid
        conn.commit()
        return eid


def _add_mention_sync(
    entity_id: int,
    source_kind: str,
    source_id: str,
    snippet: Optional[str],
    ts: Optional[float] = None,
) -> None:
    """Insert one mention row. `ts` defaults to now; pass an explicit value
    when backfilling so same-day co-occurrence reflects when the underlying
    event actually happened, not when extraction ran."""
    with _connect() as conn:
        conn.execute(
            "INSERT INTO entity_mention"
            "(entity_id, source_kind, source_id, context_snippet, ts) "
            "VALUES(?, ?, ?, ?, ?)",
            (
                entity_id,
                source_kind,
                source_id,
                snippet[:240] if snippet else None,
                ts if ts is not None else time.time(),
            ),
        )
        conn.commit()


def _day_to_ts(day: Optional[str]) -> Optional[float]:
    """Convert a YYYY-MM-DD string to a unix ts at local noon, so the day
    bucket math is unambiguous across DST and timezone math."""
    if not day:
        return None
    try:
        import datetime as _dt
        d = _dt.datetime.strptime(day, "%Y-%m-%d")
        return _dt.datetime(d.year, d.month, d.day, 12, 0, 0).timestamp()
    except Exception:
        return None


def _snippet_around(text: str, term: str, width: int = 200) -> str:
    """Return a ~`width` char window centered on `term`'s first occurrence."""
    idx = text.lower().find(term.lower())
    if idx < 0:
        return text[:width].strip()
    half = width // 2
    start = max(0, idx - half)
    end = min(len(text), idx + len(term) + half)
    return text[start:end].strip()


def index_text_sync(
    text: str,
    source_kind: str,
    source_id: str,
    ts: Optional[float] = None,
) -> int:
    """Extract from `text` + persist mentions. Returns number of entities indexed.

    `ts` is forwarded to each mention so backfilled extraction reflects when
    the underlying event happened (e.g. a check-in's `day`) rather than
    extraction time."""
    entities = extract_entities(text)
    for ent in entities:
        eid = _upsert_entity_sync(ent["name"], ent["type"], ent.get("canonical_id"))
        _add_mention_sync(
            eid, source_kind, source_id, _snippet_around(text, ent["name"]), ts=ts
        )
    return len(entities)


async def index_text(
    text: str, source_kind: str, source_id: str, ts: Optional[float] = None
) -> int:
    return await asyncio.to_thread(index_text_sync, text, source_kind, source_id, ts)


# ---------- Observation buckets (scalar check-in / event fields) ----------
#
# Mood and energy are 1–5 scales (see frontend/src/routes/CheckIn.tsx).
# Sleep is hours (float, 0–16). We coerce each scalar into one of three
# stable buckets and surface them as `type="observation"` nodes so the
# graph can show co-occurrence between named entities (e.g. magnesium)
# and recurring states (e.g. high sleep) without exploding into one node
# per check-in.

def _bucket_sleep_hours(hours: Optional[float]) -> Optional[str]:
    if hours is None:
        return None
    if hours <= 6.0:
        return "low sleep"
    if hours >= 8.0:
        return "high sleep"
    return "mid sleep"


def _bucket_1_to_5(value: Optional[int], label: str) -> Optional[str]:
    if value is None:
        return None
    if value <= 2:
        return f"low {label}"
    if value >= 4:
        return f"high {label}"
    return f"mid {label}"


def _record_observation_sync(
    name: str,
    snippet: str,
    source_kind: str,
    source_id: str,
    ts: Optional[float] = None,
) -> None:
    eid = _upsert_entity_sync(name, "observation", None)
    _add_mention_sync(eid, source_kind, source_id, snippet, ts=ts)


def index_check_in_observations_sync(check_in_id: int) -> int:
    """Bucket and record the scalar fields of one check-in as observation
    mentions. Returns the number of observations recorded (0–3)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, day, energy, sleep_hours, mood FROM check_in WHERE id = ?",
            (check_in_id,),
        ).fetchone()
    if not row:
        return 0
    n = 0
    sid = str(row["id"])
    day = row["day"] or ""
    ts = _day_to_ts(day)
    sleep_bucket = _bucket_sleep_hours(row["sleep_hours"])
    if sleep_bucket:
        _record_observation_sync(
            sleep_bucket,
            f"{day}: {row['sleep_hours']}h sleep",
            "check_in_observation",
            sid,
            ts=ts,
        )
        n += 1
    energy_bucket = _bucket_1_to_5(row["energy"], "energy")
    if energy_bucket:
        _record_observation_sync(
            energy_bucket,
            f"{day}: energy {row['energy']}/5",
            "check_in_observation",
            sid,
            ts=ts,
        )
        n += 1
    mood_bucket = _bucket_1_to_5(row["mood"], "mood")
    if mood_bucket:
        _record_observation_sync(
            mood_bucket,
            f"{day}: mood {row['mood']}/5",
            "check_in_observation",
            sid,
            ts=ts,
        )
        n += 1
    return n


def _event_observation_for(category: str, meta: dict) -> Optional[tuple[str, str]]:
    """Try to read a scalar out of an event's meta blob and bucket it.
    Returns (bucket_name, snippet) or None when the event isn't scalar-shaped."""
    if not isinstance(meta, dict):
        return None
    if category == "sleep":
        hours = meta.get("hours") or meta.get("sleep_hours") or meta.get("duration_h")
        try:
            hours_f = float(hours) if hours is not None else None
        except (TypeError, ValueError):
            hours_f = None
        bucket = _bucket_sleep_hours(hours_f)
        if bucket:
            return bucket, f"{hours_f}h sleep (logged)"
    if category == "mood":
        score = meta.get("score") or meta.get("value") or meta.get("mood")
        try:
            score_i = int(score) if score is not None else None
        except (TypeError, ValueError):
            score_i = None
        bucket = _bucket_1_to_5(score_i, "mood")
        if bucket:
            return bucket, f"mood {score_i}/5 (logged)"
    if category == "symptom":
        severity = meta.get("severity")
        try:
            sev_i = int(severity) if severity is not None else None
        except (TypeError, ValueError):
            sev_i = None
        bucket = _bucket_1_to_5(sev_i, "symptom severity")
        if bucket:
            return bucket, f"symptom severity {sev_i}/5"
    return None


def index_event_observation_sync(event_id: int) -> int:
    """If an event row carries a scalar in its meta blob, record an
    observation mention. Returns 1 if recorded, 0 otherwise."""
    import json as _json
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, category, meta_json FROM event WHERE id = ?",
            (event_id,),
        ).fetchone()
    if not row:
        return 0
    try:
        meta = _json.loads(row["meta_json"]) if row["meta_json"] else {}
    except Exception:
        meta = {}
    parsed = _event_observation_for(row["category"], meta)
    if not parsed:
        return 0
    bucket, snippet = parsed
    # Events carry their own ts; use it so observations join other
    # same-day mentions in the graph's edge math.
    ev_ts = None
    with _connect() as conn:
        ts_row = conn.execute("SELECT ts FROM event WHERE id = ?", (event_id,)).fetchone()
        if ts_row:
            ev_ts = ts_row["ts"]
    _record_observation_sync(bucket, snippet, "event_observation", str(row["id"]), ts=ev_ts)
    return 1


def index_biomarker_ids_sync(row_ids: list[int]) -> int:
    """Index a specific set of newly-inserted biomarker rows.

    Mirrors the biomarker block in `index_existing_data_sync` but scoped
    to a single panel so a lab upload doesn't re-walk all sources.
    """
    if not row_ids:
        return 0
    placeholders = ",".join("?" for _ in row_ids)
    indexed = 0
    with _connect() as conn:
        for r in conn.execute(
            f"SELECT id, name, value, unit, flag FROM biomarker WHERE id IN ({placeholders})",
            row_ids,
        ).fetchall():
            display = r["name"]
            cid = _canonical_index().get(display.lower())
            canonical_id = cid[0] if cid else None
            ctype = cid[1] if cid else "biomarker"
            eid = _upsert_entity_sync(display, ctype, canonical_id)
            unit = r["unit"] or ""
            flag = r["flag"] or "unknown"
            snippet = f"{display}: {r['value']} {unit} [{flag}]"
            _add_mention_sync(eid, "lab_biomarker", str(r["id"]), snippet)
            indexed += 1
    return indexed


# ---------- One-shot indexer over existing SQLite data ----------

def index_existing_data_sync() -> dict:
    """Walk run.memo, check_in.adherence_notes, profile.notes, biomarker,
    and event.description and persist mentions. Idempotent re entity rows;
    mention rows accumulate. Use the `clear` flag (via the API) if you
    need a clean slate."""
    counts = {
        "run_memos": 0,
        "check_ins": 0,
        "profile": 0,
        "biomarkers": 0,
        "events": 0,
    }

    with _connect() as conn:
        # Plan memos — stamp under the run's start time so same-day edges
        # land on the day the plan was actually generated.
        rows = conn.execute(
            "SELECT task_id, memo, started_at FROM run "
            "WHERE memo IS NOT NULL AND memo != ''"
        ).fetchall()
        for r in rows:
            n = index_text_sync(r["memo"], "run_memo", r["task_id"], ts=r["started_at"])
            counts["run_memos"] += n

        # Check-in adherence notes — stamp under the check-in's day so
        # observations and notes from the same check-in match in the
        # same-day co-occurrence query.
        rows = conn.execute(
            "SELECT id, day, adherence_notes FROM check_in "
            "WHERE adherence_notes IS NOT NULL AND adherence_notes != ''"
        ).fetchall()
        for r in rows:
            n = index_text_sync(
                r["adherence_notes"], "check_in_note", str(r["id"]),
                ts=_day_to_ts(r["day"]),
            )
            counts["check_ins"] += n

        # Profile notes — single row, no natural date; stamp with now.
        prow = conn.execute(
            "SELECT id, notes FROM profile WHERE notes IS NOT NULL AND notes != '' LIMIT 1"
        ).fetchone()
        if prow:
            n = index_text_sync(prow["notes"], "profile_note", str(prow["id"]))
            counts["profile"] += n

        # Lab biomarker names — direct upserts (not text extraction).
        # Stamp under the biomarker's recorded_at so labs cluster by draw date.
        for r in conn.execute(
            "SELECT id, name, value, unit, flag, recorded_at FROM biomarker"
        ).fetchall():
            display = r["name"]
            cid = _canonical_index().get(display.lower())
            canonical_id = cid[0] if cid else None
            ctype = cid[1] if cid else "biomarker"
            eid = _upsert_entity_sync(display, ctype, canonical_id)
            unit = r["unit"] or ""
            flag = r["flag"] or "unknown"
            snippet = f"{display}: {r['value']} {unit} [{flag}]"
            _add_mention_sync(
                eid, "lab_biomarker", str(r["id"]), snippet, ts=r["recorded_at"]
            )
            counts["biomarkers"] += 1

        # Events — any free-form description (notes, symptoms, meals, etc.)
        # The `note` category is the most prose-heavy, but everything with
        # a description carries entity signal worth extracting.
        for r in conn.execute(
            "SELECT id, category, description, ts FROM event "
            "WHERE description IS NOT NULL AND description != ''"
        ).fetchall():
            text = f"[{r['category']}] {r['description']}"
            n = index_text_sync(text, "event_note", str(r["id"]), ts=r["ts"])
            counts["events"] += n

    # Observation buckets — scalar fields from check-ins and events.
    # Done outside the SQL loop so each helper can open its own cursor.
    counts["observations"] = 0
    with _connect() as conn:
        check_in_ids = [r["id"] for r in conn.execute("SELECT id FROM check_in").fetchall()]
        event_ids = [r["id"] for r in conn.execute("SELECT id FROM event").fetchall()]
    for cid in check_in_ids:
        counts["observations"] += index_check_in_observations_sync(cid)
    for eid in event_ids:
        counts["observations"] += index_event_observation_sync(eid)

    return counts


async def index_existing_data() -> dict:
    return await asyncio.to_thread(index_existing_data_sync)


def clear_entities_sync() -> None:
    """Wipe both tables. Useful when re-extracting from scratch."""
    with _connect() as conn:
        conn.execute("DELETE FROM entity_mention")
        conn.execute("DELETE FROM personal_entity")
        conn.commit()


# ---------- Graph data for the viz ----------

def get_graph_data_sync(min_mentions: int = 1) -> dict:
    """Return `{nodes, links}` for the force-directed memory graph.

    Nodes: entities with `mention_count >= min_mentions`.
    Links: co-mention edges, i.e. pairs of entities that appeared in the
    same `(source_kind, source_id)`. Edge weight = co-occurrence count.
    """
    with _connect() as conn:
        node_rows = conn.execute(
            "SELECT id, name, type, canonical_id, mention_count, first_seen, last_seen "
            "FROM personal_entity WHERE mention_count >= ? "
            "ORDER BY mention_count DESC",
            (min_mentions,),
        ).fetchall()
        nodes = [
            {
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "canonical_id": r["canonical_id"],
                "mention_count": r["mention_count"],
                "first_seen": r["first_seen"],
                "last_seen": r["last_seen"],
            }
            for r in node_rows
        ]
        node_ids = {n["id"] for n in nodes}

        # Edge weights come from two sources, merged in Python:
        #   1. Same-source co-mention (existing) — two entities appearing in
        #      the same memo/note/event/biomarker row.
        #   2. Same-day co-occurrence — two entities appearing on the same
        #      calendar day across *different* sources. This is what lets a
        #      check-in "low sleep" observation link to a "magnesium"
        #      mention pulled from that day's check-in note (or biomarker,
        #      or event log).
        same_source = conn.execute(
            """
            SELECT m1.entity_id AS a, m2.entity_id AS b, COUNT(*) AS w
            FROM entity_mention m1
            JOIN entity_mention m2
              ON m1.source_kind = m2.source_kind
             AND m1.source_id   = m2.source_id
             AND m1.entity_id   < m2.entity_id
            GROUP BY m1.entity_id, m2.entity_id
            ORDER BY w DESC
            LIMIT 1000
            """
        ).fetchall()

        same_day = conn.execute(
            """
            SELECT m1.entity_id AS a, m2.entity_id AS b,
                   COUNT(DISTINCT date(m1.ts, 'unixepoch', 'localtime')) AS w
            FROM entity_mention m1
            JOIN entity_mention m2
              ON m1.entity_id < m2.entity_id
             AND date(m1.ts, 'unixepoch', 'localtime')
               = date(m2.ts, 'unixepoch', 'localtime')
             AND NOT (m1.source_kind = m2.source_kind AND m1.source_id = m2.source_id)
            GROUP BY m1.entity_id, m2.entity_id
            HAVING COUNT(DISTINCT date(m1.ts, 'unixepoch', 'localtime')) >= 2
            ORDER BY w DESC
            LIMIT 1000
            """
        ).fetchall()

        from collections import defaultdict
        weights: dict[tuple[int, int], int] = defaultdict(int)
        for r in same_source:
            weights[(r["a"], r["b"])] += r["w"]
        for r in same_day:
            weights[(r["a"], r["b"])] += r["w"]

        links = [
            {"source": a, "target": b, "value": w}
            for (a, b), w in sorted(weights.items(), key=lambda kv: -kv[1])[:500]
            if a in node_ids and b in node_ids
        ]

    return {"nodes": nodes, "links": links}


async def get_graph_data(min_mentions: int = 1) -> dict:
    return await asyncio.to_thread(get_graph_data_sync, min_mentions)


def get_entity_mentions_sync(entity_id: int, limit: int = 50) -> dict:
    with _connect() as conn:
        ent = conn.execute(
            "SELECT id, name, type, canonical_id, mention_count, first_seen, last_seen "
            "FROM personal_entity WHERE id = ?",
            (entity_id,),
        ).fetchone()
        if not ent:
            return {"entity": None, "mentions": []}
        rows = conn.execute(
            "SELECT id, source_kind, source_id, context_snippet, ts "
            "FROM entity_mention WHERE entity_id = ? "
            "ORDER BY ts DESC LIMIT ?",
            (entity_id, limit),
        ).fetchall()
        return {
            "entity": dict(ent),
            "mentions": [dict(r) for r in rows],
        }


async def get_entity_mentions(entity_id: int, limit: int = 50) -> dict:
    return await asyncio.to_thread(get_entity_mentions_sync, entity_id, limit)


def search_personal_entities_sync(
    query: str, limit: int = 8, mentions_per_entity: int = 3
) -> list[dict]:
    """Free-text search across the user's personal memory graph.

    Matches `personal_entity.name` LIKE `%query%` (case-insensitive). For each
    hit, returns the entity row plus its `mentions_per_entity` most recent
    mention snippets. Used by the Health Researcher's `query_personal_graph`
    tool to ask "what do we know about THIS user's <topic>?" before falling
    back to the canonical KB.
    """
    q = (query or "").strip()
    if not q:
        return []
    like = f"%{q.lower()}%"
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, type, canonical_id, mention_count, first_seen, last_seen "
            "FROM personal_entity WHERE LOWER(name) LIKE ? "
            "ORDER BY mention_count DESC LIMIT ?",
            (like, limit),
        ).fetchall()
        out: list[dict] = []
        for r in rows:
            mention_rows = conn.execute(
                "SELECT source_kind, source_id, context_snippet, ts "
                "FROM entity_mention WHERE entity_id = ? "
                "ORDER BY ts DESC LIMIT ?",
                (r["id"], mentions_per_entity),
            ).fetchall()
            out.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "type": r["type"],
                    "canonical_id": r["canonical_id"],
                    "mention_count": r["mention_count"],
                    "first_seen": r["first_seen"],
                    "last_seen": r["last_seen"],
                    "recent_mentions": [
                        {
                            "source_kind": m["source_kind"],
                            "source_id": m["source_id"],
                            "snippet": m["context_snippet"],
                            "ts": m["ts"],
                        }
                        for m in mention_rows
                    ],
                }
            )
        return out
