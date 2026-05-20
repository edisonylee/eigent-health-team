// API helpers — wrap fetch with shared error handling.

export interface ModelStatus {
  backend: "openai" | "ollama";
  model: string;
  openai_model: string;
  ollama_model: string;
  ollama_host: string;
  available_backends: string[];
  openai_key_set: boolean;
  ollama_reachable: boolean;
  has_usable_backend: boolean;
}

export interface MCPServer {
  name: string;
  status: "connected" | "degraded" | "disabled" | "pending";
  error: string | null;
  tools: { name: string; description: string }[];
}

export interface RunRow {
  task_id: string;
  started_at: number;
  ended_at: number | null;
  status: string;
  idea: string | null;
  memo: string | null;
  cost_usd: number;
  model_backend: string | null;
}

export interface TimelineEvent {
  id: number;
  ts: number;
  kind: string;
  role: string | null;
  payload: Record<string, unknown>;
}

export interface MemoryGraphNode {
  id: number;
  name: string;
  type: string;
  canonical_id: string | null;
  mention_count: number;
  first_seen: number | null;
  last_seen: number | null;
}

export interface MemoryGraphLink {
  source: number;
  target: number;
  value: number;
}

export interface MemoryGraphData {
  nodes: MemoryGraphNode[];
  links: MemoryGraphLink[];
}

export interface EntityMention {
  id: number;
  source_kind: string;
  source_id: string;
  context_snippet: string | null;
  ts: number;
}

export interface EntityDetail {
  entity: MemoryGraphNode | null;
  mentions: EntityMention[];
}

export interface CheckIn {
  id: number;
  day: string;
  energy: number | null;
  sleep_hours: number | null;
  mood: number | null;
  adherence_notes: string | null;
  created_at: number;
}

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  modelStatus: () => jsonFetch<ModelStatus>("/api/model/status"),
  setModelSettings: (body: {
    password: string;
    backend: string;
    openai_model?: string;
    ollama_model?: string;
    ollama_host?: string;
  }) =>
    jsonFetch<ModelStatus>("/api/model/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  mcpServers: () =>
    jsonFetch<{ servers: MCPServer[] }>("/api/mcp/servers").then((r) => r.servers),
  reconnectMCP: (name: string, password: string) =>
    jsonFetch<{ servers: MCPServer[] }>(
      `/api/mcp/servers/${encodeURIComponent(name)}/reconnect`,
      { method: "POST", body: JSON.stringify({ password }) },
    ).then((r) => r.servers),

  runs: (limit = 20) =>
    jsonFetch<{ runs: RunRow[] }>(`/api/runs?limit=${limit}`).then((r) => r.runs),
  run: (taskId: string) => jsonFetch<RunRow>(`/api/runs/${taskId}`),
  timeline: (taskId: string) =>
    jsonFetch<{ task_id: string; events: TimelineEvent[] }>(
      `/api/runs/${taskId}/timeline`,
    ).then((r) => r.events),

  profile: () => jsonFetch<Record<string, unknown>>("/api/profile"),
  saveProfile: (body: Record<string, unknown> & { password: string }) =>
    jsonFetch("/api/profile", { method: "POST", body: JSON.stringify(body) }),

  checkIns: (limit = 30) =>
    jsonFetch<{ check_ins: CheckIn[] }>(`/api/check_ins?limit=${limit}`).then(
      (r) => r.check_ins,
    ),
  addCheckIn: (body: Partial<CheckIn> & { password: string }) =>
    jsonFetch<CheckIn>("/api/check_ins", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  prompts: () =>
    jsonFetch<Record<string, string>>("/api/prompts"),

  // v3 — memory graph
  memoryGraph: (minMentions = 1) =>
    jsonFetch<MemoryGraphData>(`/api/memory-graph?min_mentions=${minMentions}`),
  entityMentions: (id: number, limit = 50) =>
    jsonFetch<EntityDetail>(
      `/api/memory-graph/entities/${id}/mentions?limit=${limit}`,
    ),
  reindexMemoryGraph: (body: { password: string; clear?: boolean }) =>
    jsonFetch<{ ok: boolean; indexed: Record<string, number> }>(
      "/api/memory-graph/reindex",
      { method: "POST", body: JSON.stringify(body) },
    ),
};
