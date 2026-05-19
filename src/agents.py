"""The four specialized agents. Each is a CAMEL ChatAgent with a distinct role.

The Health Researcher is the only agent with a tool — real web search. The
others reason over what upstream agents produced.

All agents are educational only. None of them diagnose or replace a clinician.
"""

from camel.agents import ChatAgent
from camel.models import ModelFactory
from camel.toolkits import FunctionTool, SearchToolkit
from camel.types import ModelPlatformType, ModelType

from .schema import SafetyReview


def _model(stream: bool = False):
    """One model backend per agent. Low temperature — this is careful guidance.

    stream=True enables token streaming so the Workforce stream callback emits
    incremental chunks (used by the web UI). The CLI leaves it False.
    """
    return ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI,
        model_type=ModelType.GPT_4O,
        model_config_dict={"temperature": 0.2, "stream": stream},
    )


RESEARCHER_PROMPT = """You are a health researcher.
Given a person's profile and goals, use web search to gather evidence-based,
current information relevant to those goals — nutrition guidance, exercise
approaches, sleep, and general public-health recommendations. Ground every
claim in something you actually found; if a search returns nothing useful,
say so rather than speculating. You do not diagnose. Output a bulleted
research brief. This is educational information, not medical advice."""

ASSESSOR_PROMPT = """You are a health assessor.
Given a person's profile and a research brief, identify the few highest-impact,
realistic focus areas for this specific person — considering their lifestyle,
constraints, and goals. Be concrete and practical. Do not diagnose conditions.
Output a short structured assessment. This is educational, not medical advice."""

SAFETY_PROMPT = """You are a careful health safety reviewer.
Given a person's profile and the emerging plan, surface real risks, possible
contraindications, and any red-flag symptoms that warrant prompt medical
attention. Name specific concerns, not generic ones. Then give a verdict:
'safe-to-follow', 'follow-with-caution', or 'consult-first'.
Output: a list of risks, a list of things to discuss with a clinician, the
verdict, and a one-line justification. You do not diagnose."""

PLAN_PROMPT = """You are a health plan writer.
Given the research, the assessment, and the safety review, write a tight,
encouraging personalized health plan in markdown. Sections, in order: Your
Profile, Focus Areas, Nutrition, Movement, Sleep & Recovery, Safety Notes,
When to See a Professional. End with this exact line on its own:
*This plan is educational information, not medical advice. Consult a qualified
healthcare professional before making changes, and seek prompt care for any
concerning symptoms.*"""


def health_researcher_agent(stream: bool = False) -> ChatAgent:
    search = FunctionTool(SearchToolkit().search_duckduckgo)
    return ChatAgent(
        system_message=RESEARCHER_PROMPT, model=_model(stream), tools=[search]
    )


def health_assessor_agent(stream: bool = False) -> ChatAgent:
    return ChatAgent(system_message=ASSESSOR_PROMPT, model=_model(stream))


def safety_reviewer_agent(stream: bool = False) -> ChatAgent:
    """The Safety Reviewer. Used inside the Workforce as a worker, and called
    directly (with response_format=SafetyReview) by the deterministic eval to
    get a typed SafetyReview object back."""
    return ChatAgent(system_message=SAFETY_PROMPT, model=_model(stream))


def plan_writer_agent(stream: bool = False) -> ChatAgent:
    return ChatAgent(system_message=PLAN_PROMPT, model=_model(stream))


__all__ = [
    "health_researcher_agent",
    "health_assessor_agent",
    "safety_reviewer_agent",
    "plan_writer_agent",
    "SafetyReview",
]
