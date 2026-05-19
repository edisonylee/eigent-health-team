import { useEffect, useRef } from "react";
import Gate from "./components/Gate";
import MemoPanel from "./components/MemoPanel";
import TaskGraph from "./components/TaskGraph";
import WorkerDrawer from "./components/WorkerDrawer";
import { streamRun } from "./lib/sse";
import { selectTotalCost, useStore } from "./store";

export default function App() {
  const authed = useStore((s) => s.authed);
  const idea = useStore((s) => s.idea);
  const password = useStore((s) => s.password);
  const phase = useStore((s) => s.phase);
  const error = useStore((s) => s.error);
  const totalCost = useStore(selectTotalCost);
  const prompts = useStore((s) => s.prompts);
  const setIdea = useStore((s) => s.setIdea);
  const setPrompts = useStore((s) => s.setPrompts);
  const startRun = useStore((s) => s.startRun);
  const applyEvent = useStore((s) => s.applyEvent);

  const esRef = useRef<EventSource | null>(null);

  // Fetch the system prompts once so the expand-drawer can render them.
  useEffect(() => {
    if (!authed || prompts) return;
    fetch("/api/prompts")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPrompts(p))
      .catch(() => {});
  }, [authed, prompts, setPrompts]);

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

  const showCost = totalCost > 0;

  return (
    <div className="min-h-screen bg-stone-100 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl text-stone-900">
              Personalized Health Team
            </h1>
            <p className="text-sm text-stone-500">
              A four-agent CAMEL Workforce — research, assessment, safety review, plan.
            </p>
          </div>
          {showCost && (
            <div className="text-right font-mono text-xs text-stone-500">
              <div className="uppercase tracking-wide text-[10px] text-stone-400">
                cost so far
              </div>
              <div className="text-lg text-stone-800">
                ${totalCost.toFixed(4)}
              </div>
            </div>
          )}
        </header>

        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Educational information only — not medical advice, and not a substitute
          for a qualified healthcare professional. Seek prompt care for any
          concerning symptoms.
        </div>

        <div className="mb-5 flex gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Describe yourself — age, lifestyle, goals, any concerns. e.g. 34, desk job, want more energy and to lose 10 lbs, mild back pain"
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

        <p className="mt-3 text-center text-[11px] text-stone-400">
          Click any worker node to see its system prompt, streamed output, tool
          calls, and usage.
        </p>
      </div>

      <WorkerDrawer />
    </div>
  );
}
