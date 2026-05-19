"""Wires the four agents into a CAMEL Workforce.

The Workforce has its own coordinator + task-planner agents (created by
default). It decomposes the root task and dispatches subtasks to whichever
worker fits, using each worker's `description` to route.
"""

from camel.societies.workforce import Workforce

from .agents import (
    health_assessor_agent,
    health_researcher_agent,
    plan_writer_agent,
    safety_reviewer_agent,
)


def build_workforce(stream: bool = False) -> Workforce:
    """Build the four-agent Workforce.

    stream=True enables token streaming on every worker so the web UI can
    show incremental output via the Workforce stream callback. The CLI uses
    the default (False).
    """
    wf = Workforce(
        "Personalized health team — turns a profile into a personalized health plan"
    )

    wf.add_single_agent_worker(
        "Health Researcher — gathers evidence-based, current health information "
        "using web search. Use for any subtask that needs facts from the web.",
        worker=health_researcher_agent(stream),
    )
    wf.add_single_agent_worker(
        "Health Assessor — analyzes the profile against the research and picks "
        "the highest-impact focus areas. Use for reasoning, not for gathering.",
        worker=health_assessor_agent(stream),
    )
    wf.add_single_agent_worker(
        "Safety Reviewer — reviews the plan for risks, contraindications, and "
        "red flags, then gives a safety verdict. Use to pressure-test the plan.",
        worker=safety_reviewer_agent(stream),
    )
    wf.add_single_agent_worker(
        "Plan Writer — writes the final personalized health plan in markdown. "
        "Use last, to assemble everything into the deliverable.",
        worker=plan_writer_agent(stream),
    )

    return wf
