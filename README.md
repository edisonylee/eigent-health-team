# HealthOS — Eigent Health Team v2

A local-capable, MCP-native health command center: four [CAMEL](https://github.com/camel-ai/camel)
specialist agents coordinated by a `Workforce`, with real MCP tools, mid-run
human-in-the-loop, persistent SQLite history, swappable model backends
(OpenAI default, Ollama opt-in), and an Electron desktop shell.

> **Educational information only.** This project is not medical advice and not a
> substitute for a qualified healthcare professional. It does not diagnose. Always
> consult a clinician before changing your health routine, and seek prompt care for
> any concerning symptoms.

## What it does

```
your profile + (optional lab PDF) + (optional notes folder)
        │
        ▼
┌──────────────────────────────┐
│  CAMEL Workforce             │
│  coordinator + task planner  │
└────────────┬─────────────────┘
        │
        ├──► Health Researcher  ─ MCP: health_kb (graph + KB), filesystem (notes), brave_search
        ├──► Health Assessor    ─ mid-run HITL: request_human_input
        ├──► Safety Reviewer    ─ typed SafetyReview output
        └──► Plan Writer        ─ structured markdown plan
        │
        ▼
personalized health plan + safety verdict
        │
        ▼
SQLite log of every event · timeline UI · evals dashboard
```

| Agent | Role | Tools |
|---|---|---|
| **Health Researcher** | Evidence gathering. | `query_health_graph` + `search_health_kb` (custom MCP server) · `list_notes`/`read_notes` (filesystem MCP) · `search_brave` (opt-in) · `request_human_input` |
| **Health Assessor** | Picks the highest-leverage focus areas. | `request_human_input` |
| **Safety Reviewer** | Surfaces risks, contraindications, red flags. Typed `safe-to-follow` / `follow-with-caution` / `consult-first` verdict. | `request_human_input` |
| **Plan Writer** | Final structured plan in markdown. | `request_human_input` |

## Run it

```bash
# 1. one-time deps
curl -LsSf https://astral.sh/uv/install.sh | sh    # uv
uv sync                                             # python deps
cp .env.example .env                                # add OPENAI_API_KEY
cd frontend && npm install && cd ..

# 2. backend (terminal 1)
APP_PASSWORD=demo uv run uvicorn backend.server:app --port 8000

# 3. frontend (terminal 2)
cd frontend && npm run dev
# open the Vite URL, enter APP_PASSWORD, submit a profile
```

No Docker required — Chroma runs in-process, MCP servers spawn as stdio
subprocesses, SQLite lives at `~/.healthos/healthos.db`.

### Switch to fully-local

```bash
ollama serve              # in its own terminal
ollama pull llama3.1:8b   # ~5 GB
```

Then open **Settings → Model** in the UI, pick **Ollama**, hit *Use local Ollama*.
Runs are cost-$0; nothing leaves the machine for the model call. (Brave web
search still uses cloud unless you also drop the Brave MCP server.)

## v2 architecture

### Model backends (OpenAI default, Ollama opt-in)

`src/model_config.py` exposes `ModelBackend` (`openai` | `ollama`) and a
`build_model()` factory. Every agent in the codebase routes through it —
swapping backends from the Settings UI hot-reloads the next agent created,
with no restart. Pricing is per-backend (Ollama returns `cost=0`).

### Real MCP integration

`backend/mcp_manager.py` spawns up to three stdio MCP servers in the FastAPI
lifespan and proxies CAMEL `FunctionTool` calls to them:

| Server | Type | Default state |
|---|---|---|
| `health_kb` | Custom (this repo) — wraps `src/rag.py` + `src/graph_rag.py` | always on |
| `filesystem` | Official `@modelcontextprotocol/server-filesystem` rooted at `~/.healthos/notes/` | on if `npx` present |
| `brave_search` | Official `@modelcontextprotocol/server-brave-search` | on if `BRAVE_API_KEY` set |

`request_human_input` stays in-process (the blocking semantic depends on the
runner's thread + queue — not a fit for stdio transport).

### Human-in-the-loop (mid-run, agent-initiated)

Each agent has a `request_human_input(question, choices)` tool. When the
agent decides it needs clarification, the runner emits a
`human_input_required` SSE event, the UI surfaces a question modal, and the
tool's thread blocks on a `threading.Event` until `POST /api/run/{id}/answer`
resolves it. "Use your best judgment" is always available — completed work
is never thrown away.

The timeline view renders question/answer pairs as a first-class row type
(see `frontend/src/components/AgentTimeline.tsx`).

### Persistence — SQLite, no daemon

`backend/db.py` keeps profile, biomarkers, runs, full SSE event log,
check-ins, and settings at `~/.healthos/healthos.db`. Restart-safe
follow-ups (the runner hydrates `_finished_runs` from DB on a cache miss).
Schema is idempotent — `scripts/init_db.py` or the FastAPI lifespan creates
it on first boot.

### Embedded Chroma vector store

`src/rag.py` uses [`chromadb`](https://www.trychroma.com/) in embedded mode.
Storage at `~/.healthos/vector/`. Maintainers can ship a prebuilt snapshot:

```bash
uv run python -m scripts.ingest_kb        # populate from kb_sources.txt
uv run python -m scripts.build_kb_bundle  # snapshot into data/health_kb_chroma/
```

On first launch with an empty user data dir, `_maybe_seed_from_bundle` copies
the shipped snapshot into place — first-run installs work without Firecrawl.

### Hand-curated knowledge graph (unchanged from v1)

`data/health_graph.yaml` → NetworkX `MultiDiGraph` at startup. 65 entities,
124 typed edges (`addresses`, `found_in`, `measured_by`, `interacts_with`,
`risk_factor_for`, `contraindicated_with`). Sub-millisecond traversal,
queries embedded with the same local sentence-transformers model.

## Frontend routes

| Route | What it shows |
|---|---|
| `/` | Run a plan. Live worker graph, live timeline, mid-run question modal, follow-up input on the memo. |
| `/agents` | Specialist roster — name, role, system prompt, tools (with live/disabled pill per MCP server). |
| `/check-in` | Daily energy/sleep/mood log. "Weekly synthesis" feeds the last 7 days into a follow-up. |
| `/evals` | Per-criterion mean + table from `evals/results.csv` + per-run cost from SQLite. |
| `/settings` | Model backend (OpenAI/Ollama), MCP servers (status + reconnect), Profile, Data (export/wipe). |
| `/runs/:taskId/timeline` | Full chronological view of any past run. |
| First-run modal | Auto-shown if no model backend is reachable — choose OpenAI or Ollama. |
| ⌘K palette | Navigate routes + hot-swap model backend. |

## Desktop shell

```bash
cd electron
npm install
npm start   # tsc → electron dist/main.js
```

Spawns `uv run uvicorn backend.server:app` as a child, polls
`/api/health`, then loads the app in a BrowserWindow. Cmd/Ctrl+Shift+H
toggles the window. Tray menu has Show / New check-in / Quit. Killing
the Electron process kills the backend child.

Distributable `.dmg` / `.exe` builds and full PyInstaller bundling are a
v3 follow-up — for now the shell expects `uv` on `PATH`.

## Project layout

```
eigent-health-team/
├── pyproject.toml         # uv-managed deps
├── src/                   # CAMEL agents + model factory + RAG + lab parser
│   ├── model_config.py    # OpenAI / Ollama backend abstraction
│   ├── agents.py          # ChatAgent builders + system prompts
│   ├── workforce.py       # wires agents into a CAMEL Workforce
│   ├── rag.py             # embedded Chroma retrieval
│   ├── graph_rag.py       # NetworkX health knowledge graph
│   └── lab_parser.py      # typed BiomarkerPanel extraction
├── backend/               # FastAPI app
│   ├── db.py              # SQLite persistence (profile, runs, events, check-ins)
│   ├── events.py          # typed RunEvent model
│   ├── runner.py          # Workforce runner + SSE stream + HITL + MCP adapters
│   ├── mcp_manager.py     # stdio MCP server lifecycle
│   └── server.py          # routes (incl. /api/model, /api/mcp, /api/runs, /api/data)
├── mcp_servers/           # custom health_kb stdio MCP server
├── frontend/              # React + react-router + react-query + framer-motion + cmdk
│   └── src/
│       ├── Layout.tsx
│       ├── App.tsx                       # the run page
│       ├── components/AgentTimeline.tsx  # Q&A pair rendering, live + DB modes
│       ├── components/OnboardingModal.tsx
│       ├── components/CommandPalette.tsx
│       └── routes/                       # Settings, Agents, Evals, CheckIn, Timeline
├── electron/              # Desktop wrapper (main + preload + tray)
├── data/                  # health_graph.yaml + kb_sources.txt + optional health_kb_chroma snapshot
├── scripts/               # ingest_kb · build_kb_bundle · init_db
└── evals/                 # deterministic + LLM-judge + cost_table
```

## Evals

```bash
uv run python -m evals.deterministic   # typed-output assertion on a risky profile
uv run python -m evals.llm_judge       # 1-5 ratings on coherence / actionability / safety / personalization
uv run python -m evals.cost_table      # per-worker token / cost / latency
```

The `/evals` route in the UI reads `evals/results.csv` and surfaces means.

## Known limitations

1. **Sequential latency.** Research → assessment → safety review → plan is a chain.
2. **Safety Reviewer anchoring.** It reasons over upstream framing.
3. **Brave / DuckDuckGo trade-off.** Brave needs an API key; without it the
   Researcher relies on the curated KB + graph + notes alone.
4. **PyInstaller backend bundling deferred.** Electron expects `uv` on PATH.
5. **Multi-profile not modeled yet.** v2 schema has a single profile row.

## Built for

Interview prep for the AI agent / product engineer role at
[Eigent](https://eigent.ai), built on [CAMEL-AI](https://www.camel-ai.org/).
