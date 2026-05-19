from typing import Literal

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
