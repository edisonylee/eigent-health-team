"""Lab Parser — extracts a typed BiomarkerPanel from raw lab-report text.

Used as a preprocessing step before the Workforce: the user attaches a PDF
(or pastes text), this agent normalizes it into structured biomarkers, and
those biomarkers are threaded into the root task so every downstream worker
(Researcher, Assessor, Safety Reviewer, Plan Writer) can ground its output
in the user's actual numbers.

This is intentionally a standalone ChatAgent, not a Workforce worker —
parsing is a deterministic, single-shot job, not a collaborative one.
"""

from __future__ import annotations

from camel.agents import ChatAgent

from .model_config import build_model
from .schema import BiomarkerPanel

LAB_PARSER_PROMPT = """You are a careful lab-report parser. Given the raw
text of a blood-work or lab-results document (PDF text or pasted), extract
each biomarker as a structured row:

  - name: the canonical biomarker name (e.g. "Vitamin D, 25-Hydroxy",
    "Hemoglobin A1c", "LDL Cholesterol").
  - value: the measured value as a string.
  - unit: the unit (e.g. "ng/mL", "%", "mg/dL"). Null if not stated.
  - reference_range: the printed reference range. Null if absent.
  - flag: "normal", "low", "high", or "unknown" — based on whether the
    value falls inside / below / above the printed reference range. If the
    range is missing or ambiguous, use "unknown".

Also capture, if present, the lab name (LabCorp / Quest / etc.) and the
collection or report date.

Hard rules:
  - DO NOT invent biomarkers, values, or ranges that aren't in the source.
  - If a value is unparseable, keep the row with flag="unknown".
  - Be conservative with flag — only mark normal/low/high when the range is
    clearly printed and the comparison is unambiguous.

Output the typed BiomarkerPanel schema."""


def lab_parser_agent() -> ChatAgent:
    return ChatAgent(
        system_message=LAB_PARSER_PROMPT,
        model=build_model(stream=False, temperature=0.0),
    )


def parse_labs(raw_text: str) -> BiomarkerPanel:
    """One-shot parse. Returns a BiomarkerPanel; empty list on a no-op.

    Raises only on agent / model errors. Empty / whitespace input returns
    an empty panel so callers can stay branch-free.
    """
    if not raw_text or not raw_text.strip():
        return BiomarkerPanel(biomarkers=[])

    # Cap raw text to keep token use bounded on huge PDFs.
    if len(raw_text) > 20000:
        raw_text = raw_text[:20000]

    agent = lab_parser_agent()
    response = agent.step(
        "Extract biomarkers from the following lab report. Return the "
        f"typed BiomarkerPanel.\n\n---\n{raw_text}\n---",
        response_format=BiomarkerPanel,
    )
    msg = response.msgs[0]
    parsed = getattr(msg, "parsed", None)
    if isinstance(parsed, BiomarkerPanel):
        return parsed
    return BiomarkerPanel.model_validate_json(msg.content)


def biomarkers_to_brief(panel: BiomarkerPanel) -> str:
    """Render a panel as a compact bullet block suitable for the root task."""
    if not panel.biomarkers:
        return ""
    lines = []
    if panel.lab_name or panel.date:
        meta = " · ".join(x for x in [panel.lab_name, panel.date] if x)
        lines.append(f"Lab report ({meta}):")
    else:
        lines.append("Lab report:")
    for b in panel.biomarkers:
        flag_tag = "" if b.flag in (None, "unknown") else f" [{b.flag.upper()}]"
        unit = f" {b.unit}" if b.unit else ""
        ref = f" (ref {b.reference_range})" if b.reference_range else ""
        lines.append(f"  - {b.name}: {b.value}{unit}{ref}{flag_tag}")
    return "\n".join(lines)
