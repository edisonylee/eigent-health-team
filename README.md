# Eigent Health Team

A four-agent [CAMEL](https://github.com/camel-ai/camel) **Workforce** that turns a
short personal profile into a structured, personalized health plan.

> **Educational information only.** This project is not medical advice and not a
> substitute for a qualified healthcare professional. It does not diagnose. Always
> consult a clinician before changing your health routine, and seek prompt care for
> any concerning symptoms.

```
python -m src.main "34, desk job, want more energy and to lose 10 lbs, mild back pain"
```

```
building a plan for: 34, desk job, want more energy and to lose 10 lbs, mild back pain
------------------------------------------------

--- HEALTH PLAN ---

# Personalized Health Plan
## Your Profile ...
## Focus Areas ...
## Nutrition ...
## Movement ...
## Sleep & Recovery ...
## Safety Notes ...
## When to See a Professional ...

saved -> outputs/2026-05-19T10-30-34-desk-job-want-more.md
```

## How it works

A CAMEL `Workforce` with a coordinator + task-planner decomposes the root task and
dispatches subtasks to four specialized `ChatAgent` workers:

```
              ┌──────────────────────────┐
              │  Workforce               │
              │  coordinator + planner   │
              └────────────┬─────────────┘
        ┌────────────┬──────┴─────┬────────────┐
        ▼            ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐
  │  Health  │ │  Health  │ │  Safety  │ │    Plan    │
  │Researcher│ │ Assessor │ │ Reviewer │ │   Writer   │
  │+ web tool│ │          │ │          │ │            │
  └──────────┘ └──────────┘ └──────────┘ └────────────┘
        └────────────┴────────────┴────────────┘
                      ▼
            shared task context (Workforce memory)
                      ▼
              personalized health plan (markdown)
```

| Agent | Role | Tool |
|---|---|---|
| **Health Researcher** | Gathers evidence-based, current health information relevant to the person's goals. | DuckDuckGo web search (`SearchToolkit`) |
| **Health Assessor** | Reviews the profile against the research; picks the highest-impact, realistic focus areas. | — |
| **Safety Reviewer** | Surfaces risks, contraindications, and red flags; returns a `safe-to-follow` / `follow-with-caution` / `consult-first` verdict. | — |
| **Plan Writer** | Assembles everything into a structured health-plan in markdown. | — |

The Safety Reviewer's output is modeled as a typed schema — see
[`src/schema.py`](src/schema.py). That `SafetyReview` type is what the deterministic
eval asserts against.

## Run it

```bash
# 1. install uv (one-time):  curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync                        # create .venv and install deps
cp .env.example .env           # then add your OPENAI_API_KEY
uv run python -m src.main "your profile — age, lifestyle, goals, concerns"
```

## Web app

The same Workforce, wrapped in a web UI that streams progress live — a FastAPI
backend and a React + React Flow frontend. The agent graph lights up node by node
as each worker runs, with token-by-token streaming, and the plan renders at the end.

```bash
# backend (terminal 1)
APP_PASSWORD=demo123 uv run uvicorn backend.server:app --port 8000

# frontend (terminal 2)
cd frontend && npm install && npm run dev
# open the Vite URL, enter the password, submit a profile
```

The backend serves the built frontend in production, so the whole thing deploys as a
**single Docker service** (see `Dockerfile` + `render.yaml`). Two env vars:
`OPENAI_API_KEY` and `APP_PASSWORD` (a gate on the page).

Stack: FastAPI · Uvicorn · SSE step events · React · TypeScript · Zustand · React
Flow · Tailwind — the same shape as Eigent's own desktop product.

## Project layout

```
eigent-health-team/
├── pyproject.toml          # uv-managed deps
├── .env.example            # OPENAI_API_KEY
├── src/                    # core CAMEL logic — powers both the CLI and the web app
│   ├── schema.py           # Pydantic SafetyReview — the Safety Reviewer's typed output
│   ├── agents.py           # the four ChatAgent builders + system prompts
│   ├── workforce.py        # wires the agents into a CAMEL Workforce
│   └── main.py             # CLI: profile -> health plan
├── backend/                # FastAPI app — runs the Workforce, streams SSE events
│   ├── events.py           # typed RunEvent model
│   ├── runner.py           # async runner + stream callback + rate limit
│   └── server.py           # routes + serves the built frontend
├── frontend/               # React + React Flow + Zustand (Vite + TS)
├── Dockerfile              # multi-stage build — one deployable service
├── render.yaml             # Render deploy config
├── outputs/                # generated health plans
└── evals/                  # deterministic + LLM-judge evals
```

## Known limitations

Honest about these — every multi-agent system has them:

1. **Sequential latency.** Research → assessment → safety review → plan is a chain; a
   full run takes tens of seconds.
2. **Safety Reviewer anchoring.** The reviewer reasons over upstream framing, so it can
   inherit blind spots. An independent red-flag pass would strengthen it.
3. **Search quality.** DuckDuckGo's free endpoint returns sparse results for niche
   queries. Swapping in a medical-literature source would make the research stronger.

## Built for

Interview prep for the AI agent / product engineer role at
[Eigent](https://eigent.ai), built on [CAMEL-AI](https://www.camel-ai.org/).
