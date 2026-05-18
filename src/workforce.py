"""Wires the four agents into a CAMEL Workforce.

The Workforce has its own coordinator + task-planner agents (created by
default). It decomposes the root task and dispatches subtasks to whichever
worker fits, using each worker's `description` to route.
"""

from camel.societies.workforce import Workforce

from .agents import (
    analyst_agent,
    critic_agent,
    researcher_agent,
    summarizer_agent,
)


def build_workforce(stream: bool = False) -> Workforce:
    """Build the four-agent Workforce.

    stream=True enables token streaming on every worker so the web UI can
    show incremental output via the Workforce stream callback. The CLI uses
    the default (False).
    """
    wf = Workforce("Startup research team — turns a startup idea into a market memo")

    wf.add_single_agent_worker(
        "Researcher — gathers concrete, recent market signals using web search. "
        "Use for any subtask that needs facts from the web.",
        worker=researcher_agent(stream),
    )
    wf.add_single_agent_worker(
        "Market Analyst — evaluates market size, competition, demand, and unit "
        "economics. Use for reasoning over research, not for gathering it.",
        worker=analyst_agent(stream),
    )
    wf.add_single_agent_worker(
        "Critic — surfaces risks and weak assumptions, then gives a verdict of "
        "strong / mixed / weak. Use to pressure-test the analysis.",
        worker=critic_agent(stream),
    )
    wf.add_single_agent_worker(
        "Summarizer — writes the final one-page market memo in markdown. Use "
        "last, to assemble everything into the deliverable.",
        worker=summarizer_agent(stream),
    )

    return wf
