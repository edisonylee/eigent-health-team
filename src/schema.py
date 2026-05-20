from typing import Literal, Optional

from pydantic import BaseModel, Field


class SafetyReview(BaseModel):
    """Typed output of the Safety Reviewer agent.

    Defining the review as a schema (not free text) is what lets the
    deterministic eval in evals/ assert on the reviewer's behavior.
    """

    risks: list[str] = Field(
        description="Concrete health risks or things to be cautious about in the plan."
    )
    consult_a_professional: list[str] = Field(
        description="Specific things the person should discuss with a real clinician."
    )
    verdict: Literal["safe-to-follow", "follow-with-caution", "consult-first"]
    one_line_summary: str = Field(
        description="A single sentence justifying the verdict."
    )


class Biomarker(BaseModel):
    """One row from a lab / blood-work report."""

    name: str = Field(description="Biomarker name, e.g. 'Vitamin D, 25-Hydroxy'.")
    value: str = Field(
        description="Measured value, kept as a string to allow numeric or "
        "qualitative ('Positive') values."
    )
    unit: Optional[str] = Field(
        default=None, description="Unit of measurement, e.g. 'ng/mL'."
    )
    reference_range: Optional[str] = Field(
        default=None, description="Reference range as printed on the report."
    )
    flag: Literal["normal", "low", "high", "unknown"] = Field(
        default="unknown",
        description="Whether the value is in range, low, or high.",
    )


class BiomarkerPanel(BaseModel):
    """A parsed lab-report panel."""

    lab_name: Optional[str] = Field(
        default=None, description="Name of the lab or testing service."
    )
    date: Optional[str] = Field(
        default=None, description="Collection or report date if available."
    )
    biomarkers: list[Biomarker] = Field(default_factory=list)
