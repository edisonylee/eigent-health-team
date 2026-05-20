"""Auto-synthesize an "About me" paragraph from the user's data.

Distinct from the memory graph (which is entity-level): this is the
prose-level rolling synthesis the agents have been building about the
user. The Profile route renders this as read-only.

Sources, in priority order:
  1. Recent check-in notes (energy/sleep/mood + adherence_notes)
  2. Recent run memos (closing health plans the Workforce produced)
  3. Current biomarkers with flag != normal
  4. Profile basics (name, dob, sex)

Triggered as a daemon thread by:
  - `add_check_in` (after a new check-in lands)
  - `runner.finalize_run` (after a Workforce run completes)

Failures are swallowed — synthesis is additive, never blocking.
"""

from __future__ import annotations

import threading
import time
from typing import Optional

from camel.agents import ChatAgent

from src.model_config import build_model

from . import db


_SYNTHESIS_PROMPT = """You produce a detailed "About me" briefing for a
personal health AI to read at the start of every run. Write in second
person ("you have…", "you train at…") so it reads as the agent's
working model of the user.

Style:
  - 4–6 paragraphs, roughly 400–600 words total. Plain prose; no bullet
    lists, no headers, no preface.
  - Cover, in roughly this order: background and demographics; current
    conditions, symptoms, and watchpoints; recent biomarker trends with
    direction (rising / falling / in-range) and clinical context; the
    supplement and medication stack with cadence; training rhythm,
    venues, and partners; food patterns and dietary work; the providers
    and people in the user's support system; what has and has not
    worked when the user has tried things; the user's current focus
    and goals as inferred from the data.
  - Concrete and specific. Name providers, supplements, biomarkers,
    activities, places, people, foods that recur in the data. Quote
    or paraphrase memorable check-in lines when they reveal preference
    or pattern.
  - Note ongoing conditions, current goals, and what the user has
    responded well or poorly to. If the data is thin in some area, say
    so honestly ("you haven't logged much about X yet") rather than
    inventing detail.
  - Do not editorialize, prescribe, or moralize. Do not invent facts
    that aren't in the sources. Do not address the reader as "the
    user" — the agent reading this IS the reader-facing voice; you are
    summarizing for it.

Return only the paragraphs. No headers, no preface, no closing line."""


def _build_input(
    profile: Optional[dict],
    check_ins: list[dict],
    run_memos: list[dict],
    biomarkers: list[dict],
    graph_entities: list[dict],
    events: list[dict],
) -> str:
    parts: list[str] = []

    if profile:
        bits = []
        if profile.get("name"):
            bits.append(f"name: {profile['name']}")
        if profile.get("dob"):
            bits.append(f"dob: {profile['dob']}")
        if profile.get("sex"):
            bits.append(f"sex: {profile['sex']}")
        if bits:
            parts.append("# Profile basics\n" + " · ".join(bits))

    if graph_entities:
        # Group by type so the synthesizer can lean on the entity-level
        # cross-reference, not just the raw text. The memory graph IS the
        # backbone of who this person is — names that recur across sources
        # are signal.
        by_type: dict[str, list[str]] = {}
        for e in graph_entities:
            line = f"{e['name']} (×{e['mention_count']})"
            by_type.setdefault(e["type"], []).append(line)
        lines = [
            "# Memory graph — recurring entities (×N = times mentioned)",
            "These are the people, places, supplements, conditions, foods,",
            "and activities that show up repeatedly across your data.",
        ]
        for t in sorted(by_type):
            lines.append(f"  {t}: " + ", ".join(by_type[t][:15]))
        parts.append("\n".join(lines))

    if biomarkers:
        lines = ["# Recent biomarkers"]
        for b in biomarkers:
            flag = (b.get("flag") or "normal").upper()
            unit = b.get("unit") or ""
            lines.append(f"  - {b['name']}: {b['value']} {unit} [{flag}]")
        parts.append("\n".join(lines))

    if check_ins:
        lines = ["# Recent check-ins (newest first)"]
        for c in check_ins:
            day = c.get("day", "?")
            stats = []
            if c.get("energy") is not None:
                stats.append(f"energy {c['energy']}/5")
            if c.get("sleep_hours") is not None:
                stats.append(f"sleep {c['sleep_hours']}h")
            if c.get("mood") is not None:
                stats.append(f"mood {c['mood']}/5")
            notes = (c.get("adherence_notes") or "").strip()
            stat_str = f" — {', '.join(stats)}" if stats else ""
            note_str = f" — {notes}" if notes else ""
            lines.append(f"  - {day}{stat_str}{note_str}")
        parts.append("\n".join(lines))

    if run_memos:
        lines = ["# Recent run memos (the plans the agents wrote)"]
        for r in run_memos:
            idea = (r.get("idea") or "").strip()
            memo = (r.get("memo") or "").strip()
            if not memo:
                continue
            head = memo[:600]
            lines.append(f"  - Idea: {idea}\n    Plan: {head}")
        parts.append("\n".join(lines))

    if events:
        lines = [
            "# Recent notes & events (free-form, logged ad-hoc — not daily)",
        ]
        for e in events:
            day = e.get("day") or "?"
            cat = e.get("category") or "?"
            desc = (e.get("description") or "").strip()
            if not desc:
                continue
            lines.append(f"  - {day} [{cat}] {desc}")
        parts.append("\n".join(lines))

    if not parts:
        return ""
    return "\n\n".join(parts)


def _top_graph_entities_sync(limit: int = 80) -> list[dict]:
    """Top personal_entity rows by mention_count.

    The memory graph IS the longitudinal cross-reference of who the user
    is — a person who shows up across 12 check-ins and 3 run memos is
    structurally more important than a one-off name. Feed that into the
    synthesizer as primary signal alongside the raw text.
    """
    with db._connect() as conn:
        rows = conn.execute(
            "SELECT name, type, mention_count, canonical_id "
            "FROM personal_entity "
            "ORDER BY mention_count DESC, name ASC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def _recent_biomarkers_sync(limit: int = 20) -> list[dict]:
    """Most recent biomarker row per name (so we get current values)."""
    with db._connect() as conn:
        rows = conn.execute(
            """
            SELECT b.name, b.value, b.unit, b.flag, b.recorded_at
            FROM biomarker b
            JOIN (
                SELECT name, MAX(recorded_at) AS mx
                FROM biomarker GROUP BY name
            ) latest
              ON latest.name = b.name AND latest.mx = b.recorded_at
            ORDER BY b.recorded_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def synthesize_profile_sync(
    check_in_limit: int = 21,
    memo_limit: int = 5,
) -> Optional[dict]:
    """Pull sources, ask the LLM for a paragraph, persist to profile.notes.

    Returns a small dict the caller can log; None if there's no input.
    """
    profile = db.get_profile_sync()
    check_ins = db.list_check_ins_sync(limit=check_in_limit)
    runs = db.list_runs_sync(limit=memo_limit * 2)
    run_memos = [r for r in runs if (r.get("memo") or "").strip()][:memo_limit]
    biomarkers = _recent_biomarkers_sync(limit=20)
    graph_entities = _top_graph_entities_sync(limit=80)
    events = db.list_events_sync(limit=40)

    payload = _build_input(
        profile, check_ins, run_memos, biomarkers, graph_entities, events
    )
    if not payload.strip():
        return None

    agent = ChatAgent(
        system_message=_SYNTHESIS_PROMPT,
        model=build_model(stream=False, temperature=0.3),
    )
    try:
        resp = agent.step(
            "Here is the user's data:\n\n" + payload +
            "\n\nWrite the About-me paragraph now."
        )
    except Exception:
        return None
    text = (resp.msgs[0].content if resp.msgs else "").strip()
    if not text:
        return None

    # Persist as the profile.notes and stamp the synthesis time.
    existing = profile or {}
    db.upsert_profile_sync({
        "name": existing.get("name"),
        "dob": existing.get("dob"),
        "sex": existing.get("sex"),
        "height_cm": existing.get("height_cm"),
        "weight_kg": existing.get("weight_kg"),
        "notes": text,
    })
    now = time.time()
    db.set_setting_sync("profile_synthesized_at", str(now))
    db.set_setting_sync(
        "profile_synthesis_counts",
        f"{len(check_ins)}|{len(run_memos)}|{len(biomarkers)}",
    )
    db.set_setting_sync(
        "profile_synthesis_entity_count", str(len(graph_entities))
    )
    return {
        "synthesized_at": now,
        "check_ins": len(check_ins),
        "run_memos": len(run_memos),
        "biomarkers": len(biomarkers),
        "graph_entities": len(graph_entities),
        "events": len(events),
        "notes": text,
    }


def get_synthesis_meta_sync() -> dict:
    """Return the cached synthesis timestamp + counts (for the UI)."""
    ts_raw = db.get_setting_sync("profile_synthesized_at")
    counts_raw = db.get_setting_sync("profile_synthesis_counts") or ""
    try:
        ts = float(ts_raw) if ts_raw else None
    except ValueError:
        ts = None
    check_ins = run_memos = biomarkers = 0
    if counts_raw and counts_raw.count("|") == 2:
        try:
            a, b, c = counts_raw.split("|")
            check_ins, run_memos, biomarkers = int(a), int(b), int(c)
        except ValueError:
            pass
    return {
        "synthesized_at": ts,
        "check_ins": check_ins,
        "run_memos": run_memos,
        "biomarkers": biomarkers,
    }


def spawn_profile_synthesis() -> None:
    """Fire-and-forget synthesis on a daemon thread.

    Mirrors `runner._spawn_entity_extract` — LLM call is the slow part
    and we never want it to block the request handler that triggered it.
    """
    def _go() -> None:
        try:
            synthesize_profile_sync()
        except Exception:
            pass

    threading.Thread(target=_go, daemon=True).start()
