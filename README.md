# Eigent Startup Research Team

A four-agent [CAMEL](https://github.com/camel-ai/camel) **Workforce** that turns a one-line
startup idea into a structured market memo.

```
python -m src.main "subscription socks for cats, $12/mo"
```

```
researching: subscription socks for cats, $12/mo
------------------------------------------------

--- MEMO ---

# Market Memo — Subscription Socks for Cats
## Idea ...
## Market ...
## Competition ...
## Risks ...
## Verdict — weak

saved -> outputs/2026-05-18T14-30-subscription-socks-for-cats.md
```

## How it works

A CAMEL `Workforce` with a coordinator + task-planner decomposes the root task and
dispatches subtasks to four specialized `ChatAgent` workers:

```
              ┌──────────────────────────┐
              │  Workforce               │
              │  coordinator + planner   │
              └────────────┬─────────────┘
        ┌────────────┬─────┴──────┬────────────┐
        ▼            ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌────────┐  ┌────────────┐
   │Researcher│ │ Analyst │  │ Critic │  │ Summarizer │
   │+ web tool│ │         │  │        │  │            │
   └─────────┘  └─────────┘  └────────┘  └────────────┘
        └────────────┴────────────┴────────────┘
                      ▼
            shared task context (Workforce memory)
                      ▼
                market memo (markdown)
```

| Agent | Role | Tool |
|---|---|---|
| **Researcher** | Gathers concrete, recent market signals — market size, competitors, pricing, demand, regulation. | DuckDuckGo web search (`SearchToolkit`) |
| **Market Analyst** | Reasons over the research: TAM, competitive intensity, demand strength, unit economics. | — |
| **Critic** | Surfaces real risks and weak assumptions; returns a `strong` / `mixed` / `weak` verdict. | — |
| **Summarizer** | Assembles everything into a one-page markdown memo. | — |

The Critic's output is modeled as a typed schema — see [`src/schema.py`](src/schema.py).
That `Critique` type is what the deterministic eval (Day B) asserts against.

## Run it

```bash
# 1. install uv (one-time):  curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync                        # create .venv and install deps
cp .env.example .env           # then add your OPENAI_API_KEY
uv run python -m src.main "your startup idea here"
```

## Web app

The same Workforce, wrapped in a web UI that streams progress live — a FastAPI
backend and a React + React Flow frontend. The agent graph lights up node by node
as each worker runs, with token-by-token streaming, and the memo renders at the end.

```bash
# backend (terminal 1)
APP_PASSWORD=demo123 uv run uvicorn backend.server:app --port 8000

# frontend (terminal 2)
cd frontend && npm install && npm run dev
# open the Vite URL, enter the password, submit an idea
```

The backend serves the built frontend in production, so the whole thing deploys as a
**single Docker service** (see `Dockerfile` + `render.yaml`). Two env vars:
`OPENAI_API_KEY` and `APP_PASSWORD` (a gate on the page).

Stack: FastAPI · Uvicorn · SSE step events · React · TypeScript · Zustand · React
Flow · Tailwind — the same shape as Eigent's own desktop product.

## Project layout

```
eigent-startup-team/
├── pyproject.toml          # uv-managed deps
├── .env.example            # OPENAI_API_KEY
├── src/                    # core CAMEL logic — powers both the CLI and the web app
│   ├── schema.py           # Pydantic Critique — the Critic's typed output
│   ├── agents.py           # the four ChatAgent builders + system prompts
│   ├── workforce.py        # wires the agents into a CAMEL Workforce
│   └── main.py             # CLI: idea -> memo
├── backend/                # FastAPI app — runs the Workforce, streams SSE events
│   ├── events.py           # typed RunEvent model
│   ├── runner.py           # async runner + stream callback + rate limit
│   └── server.py           # routes + serves the built frontend
├── frontend/               # React + React Flow + Zustand (Vite + TS)
├── Dockerfile              # multi-stage build — one deployable service
├── render.yaml             # Render deploy config
├── outputs/                # generated memos
└── evals/                  # deterministic + LLM-judge evals (Day B)
```

## Known limitations

Honest about these — every multi-agent system has them:

1. **Sequential latency.** Research → analysis → critique → memo is a chain; a full
   run takes tens of seconds. Researcher and Analyst could overlap for some idea types.
2. **Critic anchoring.** The Critic reasons over the Researcher's framing, so it can
   inherit the Researcher's blind spots. An independent fact-check pass would help.
3. **Search quality.** DuckDuckGo's free endpoint returns sparse results for niche
   queries. Swapping in Tavily or Exa would make the research more reliable.

## Built for

Interview prep for the AI agent / product engineer role at
[Eigent](https://eigent.ai), built on [CAMEL-AI](https://www.camel-ai.org/).
