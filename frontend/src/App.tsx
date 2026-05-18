import { useRef } from "react";
import Gate from "./components/Gate";
import MemoPanel from "./components/MemoPanel";
import TaskGraph from "./components/TaskGraph";
import { streamRun } from "./lib/sse";
import { useStore } from "./store";

export default function App() {
  const authed = useStore((s) => s.authed);
  const idea = useStore((s) => s.idea);
  const password = useStore((s) => s.password);
  const phase = useStore((s) => s.phase);
  const error = useStore((s) => s.error);
  const setIdea = useStore((s) => s.setIdea);
  const startRun = useStore((s) => s.startRun);
  const applyEvent = useStore((s) => s.applyEvent);

  const esRef = useRef<EventSource | null>(null);

  if (!authed) return <Gate />;

  const running = phase === "running";

  const run = async () => {
    if (!idea.trim() || running) return;
    startRun();
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        applyEvent({ type: "error", text: body.detail || `HTTP ${res.status}` });
        return;
      }
      const { task_id } = await res.json();
      esRef.current?.close();
      esRef.current = streamRun(task_id, (ev) => {
        applyEvent(ev);
        if (ev.type === "task_complete" || ev.type === "error") {
          esRef.current?.close();
        }
      });
    } catch (err) {
      applyEvent({ type: "error", text: String(err) });
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="font-serif text-2xl text-stone-900">
            Startup Research Team
          </h1>
          <p className="text-sm text-stone-500">
            A four-agent CAMEL Workforce — research, analysis, critique, memo.
          </p>
        </header>

        <div className="mb-5 flex gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="A startup idea — e.g. AI meal planner for college students, $5/mo"
            disabled={running}
            className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 disabled:bg-stone-50"
          />
          <button
            onClick={run}
            disabled={running || !idea.trim()}
            className="rounded-md bg-stone-900 px-6 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>

        {phase === "error" && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <TaskGraph />

        <div className="mt-6">
          <MemoPanel />
        </div>
      </div>
    </div>
  );
}
