import { create } from "zustand";

export type Role = "researcher" | "analyst" | "critic" | "summarizer";

export const ROLE_ORDER: Role[] = [
  "researcher",
  "analyst",
  "critic",
  "summarizer",
];

export const ROLE_LABEL: Record<Role, string> = {
  researcher: "Researcher",
  analyst: "Market Analyst",
  critic: "Critic",
  summarizer: "Summarizer",
};

export type Status = "pending" | "running" | "done";
export type Phase = "idle" | "running" | "done" | "error";

/** One server-sent event from a run. Mirrors backend/events.py RunEvent. */
export interface RunEvent {
  type:
    | "task_started"
    | "worker_running"
    | "worker_chunk"
    | "task_complete"
    | "error";
  role?: Role;
  text?: string;
  mode?: string;
  memo?: string;
}

interface WorkerState {
  status: Status;
  text: string;
}

interface Store {
  phase: Phase;
  idea: string;
  password: string;
  authed: boolean;
  workers: Record<Role, WorkerState>;
  memo: string;
  error: string;
  setIdea: (v: string) => void;
  setPassword: (v: string) => void;
  setAuthed: (v: boolean) => void;
  startRun: () => void;
  applyEvent: (e: RunEvent) => void;
}

const freshWorkers = (): Record<Role, WorkerState> =>
  Object.fromEntries(
    ROLE_ORDER.map((r) => [r, { status: "pending", text: "" }]),
  ) as Record<Role, WorkerState>;

export const useStore = create<Store>((set) => ({
  phase: "idle",
  idea: "",
  password: sessionStorage.getItem("est_pw") || "",
  authed: false,
  workers: freshWorkers(),
  memo: "",
  error: "",

  setIdea: (v) => set({ idea: v }),
  setPassword: (v) => set({ password: v }),
  setAuthed: (v) => set({ authed: v }),

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
        workers[e.role] = { status: "running", text };
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
