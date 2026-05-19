import { create } from "zustand";

export type Role = "researcher" | "analyst" | "critic" | "summarizer";

export const ROLE_ORDER: Role[] = [
  "researcher",
  "analyst",
  "critic",
  "summarizer",
];

export const ROLE_LABEL: Record<Role, string> = {
  researcher: "Health Researcher",
  analyst: "Health Assessor",
  critic: "Safety Reviewer",
  summarizer: "Plan Writer",
};

export type Status = "pending" | "running" | "done";
export type Phase = "idle" | "running" | "done" | "error";

/** One server-sent event from a run. Mirrors backend/events.py RunEvent. */
export interface RunEvent {
  type:
    | "task_started"
    | "worker_running"
    | "worker_chunk"
    | "worker_usage"
    | "tool_call"
    | "task_complete"
    | "error";
  role?: Role;
  text?: string;
  mode?: string;
  memo?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  tool_name?: string;
  tool_query?: string;
  retrieved_sources?: { url: string; title: string; score: number }[];
}

export interface ToolCall {
  name: string;
  query: string;
  sources?: { url: string; title: string; score: number }[];
}

interface WorkerState {
  status: Status;
  text: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  toolCalls: ToolCall[];
}

interface Store {
  phase: Phase;
  idea: string;
  password: string;
  authed: boolean;
  workers: Record<Role, WorkerState>;
  memo: string;
  error: string;
  expandedRole: Role | null;
  prompts: Record<Role, string> | null;
  setIdea: (v: string) => void;
  setPassword: (v: string) => void;
  setAuthed: (v: boolean) => void;
  setExpanded: (r: Role | null) => void;
  setPrompts: (p: Record<Role, string>) => void;
  startRun: () => void;
  applyEvent: (e: RunEvent) => void;
}

const freshWorker = (): WorkerState => ({
  status: "pending",
  text: "",
  promptTokens: 0,
  completionTokens: 0,
  cost: 0,
  toolCalls: [],
});

const freshWorkers = (): Record<Role, WorkerState> =>
  Object.fromEntries(ROLE_ORDER.map((r) => [r, freshWorker()])) as Record<
    Role,
    WorkerState
  >;

export const useStore = create<Store>((set) => ({
  phase: "idle",
  idea: "",
  password: sessionStorage.getItem("est_pw") || "",
  authed: false,
  workers: freshWorkers(),
  memo: "",
  error: "",
  expandedRole: null,
  prompts: null,

  setIdea: (v) => set({ idea: v }),
  setPassword: (v) => set({ password: v }),
  setAuthed: (v) => set({ authed: v }),
  setExpanded: (r) => set({ expandedRole: r }),
  setPrompts: (p) => set({ prompts: p }),

  startRun: () =>
    set({ phase: "running", workers: freshWorkers(), memo: "", error: "" }),

  applyEvent: (e) =>
    set((s) => {
      if (e.type === "task_started") return { phase: "running" };

      if (e.type === "worker_running" && e.role) {
        const workers = { ...s.workers };
        // Sequential cascade: any other still-running worker is now done.
        for (const r of ROLE_ORDER) {
          if (r !== e.role && workers[r].status === "running") {
            workers[r] = { ...workers[r], status: "done" };
          }
        }
        workers[e.role] = { ...workers[e.role], status: "running" };
        return { workers };
      }

      if (e.type === "worker_chunk" && e.role) {
        const workers = { ...s.workers };
        const prev = workers[e.role];
        const text =
          e.mode === "accumulate"
            ? e.text || ""
            : prev.text + (e.text || "");
        workers[e.role] = { ...prev, status: "running", text };
        return { workers };
      }

      if (e.type === "worker_usage" && e.role) {
        const workers = { ...s.workers };
        workers[e.role] = {
          ...workers[e.role],
          promptTokens: e.prompt_tokens ?? workers[e.role].promptTokens,
          completionTokens:
            e.completion_tokens ?? workers[e.role].completionTokens,
          cost: e.cost ?? workers[e.role].cost,
        };
        return { workers };
      }

      if (e.type === "tool_call" && e.role) {
        const workers = { ...s.workers };
        const prev = workers[e.role];
        workers[e.role] = {
          ...prev,
          toolCalls: [
            ...prev.toolCalls,
            {
              name: e.tool_name || "tool",
              query: e.tool_query || "",
              sources: e.retrieved_sources,
            },
          ],
        };
        return { workers };
      }

      if (e.type === "task_complete") {
        const workers = { ...s.workers };
        for (const r of ROLE_ORDER) {
          workers[r] = { ...workers[r], status: "done" };
        }
        return { phase: "done", memo: e.memo || "", workers };
      }

      if (e.type === "error") {
        return { phase: "error", error: e.text || "Run failed." };
      }

      return {};
    }),
}));

/** Cumulative cost across all four workers — derived selector. */
export const selectTotalCost = (s: { workers: Record<Role, WorkerState> }) =>
  ROLE_ORDER.reduce((acc, r) => acc + s.workers[r].cost, 0);
