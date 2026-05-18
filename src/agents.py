"""The four specialized agents. Each is a CAMEL ChatAgent with a distinct role.

The Researcher is the only agent with a tool — real web search. The others
reason over what upstream agents produced.
"""

from camel.agents import ChatAgent
from camel.models import ModelFactory
from camel.toolkits import FunctionTool, SearchToolkit
from camel.types import ModelPlatformType, ModelType

from .schema import Critique


def _model(stream: bool = False):
    """One model backend per agent. Low temperature — this is analysis, not prose.

    stream=True enables token streaming so the Workforce stream callback emits
    incremental chunks (used by the web UI). The CLI leaves it False.
    """
    return ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI,
        model_type=ModelType.GPT_4O,
        model_config_dict={"temperature": 0.2, "stream": stream},
    )


RESEARCHER_PROMPT = """You are a market researcher.
Given a startup idea, use web search to gather concrete, recent signals:
market-size figures, named competitors, pricing, demand indicators, and any
regulatory notes. Ground every claim in something you actually found — if a
search returns nothing useful, say so explicitly rather than speculating.
Output a bulleted research brief."""

ANALYST_PROMPT = """You are a market analyst.
Given a research brief on a startup idea, evaluate the total addressable
market, competitive intensity, demand strength, and whether the unit
economics are plausible. Be specific and quantitative wherever the research
supports it. Do not invent numbers. Output a structured analysis."""

CRITIC_PROMPT = """You are a sharp, skeptical startup critic.
Given a startup idea and its market analysis, surface the real risks and the
weak assumptions baked into the pitch. Name specific failure modes, not
generic ones. Then give a verdict: 'strong', 'mixed', or 'weak'.
Output: a list of risks, a list of weak assumptions, the verdict, and a
one-line justification."""

SUMMARIZER_PROMPT = """You are an editor.
Given the research, the analysis, and the critique, write a tight one-page
market memo in markdown. Sections, in order: Idea, Market, Competition,
Risks, Verdict. No fluff — the reader is a busy investor."""


def researcher_agent(stream: bool = False) -> ChatAgent:
    search = FunctionTool(SearchToolkit().search_duckduckgo)
    return ChatAgent(
        system_message=RESEARCHER_PROMPT, model=_model(stream), tools=[search]
    )


def analyst_agent(stream: bool = False) -> ChatAgent:
    return ChatAgent(system_message=ANALYST_PROMPT, model=_model(stream))


def critic_agent(stream: bool = False) -> ChatAgent:
    """The Critic. Used inside the Workforce as a worker, and called directly
    (with response_format=Critique) by the deterministic eval to get a typed
    Critique object back."""
    return ChatAgent(system_message=CRITIC_PROMPT, model=_model(stream))


def summarizer_agent(stream: bool = False) -> ChatAgent:
    return ChatAgent(system_message=SUMMARIZER_PROMPT, model=_model(stream))


__all__ = [
    "researcher_agent",
    "analyst_agent",
    "critic_agent",
    "summarizer_agent",
    "Critique",
]
