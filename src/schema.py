from typing import Literal

from pydantic import BaseModel, Field


class Critique(BaseModel):
    """Typed output of the Critic agent.

    Defining the critique as a schema (not free text) is what lets the
    deterministic eval in evals/ assert on the Critic's behavior.
    """

    risks: list[str] = Field(
        description="Concrete, specific risks to the business. Not generic platitudes."
    )
    weak_assumptions: list[str] = Field(
        description="Assumptions baked into the pitch that may not hold."
    )
    verdict: Literal["strong", "mixed", "weak"]
    one_line_summary: str = Field(
        description="A single sentence justifying the verdict."
    )
