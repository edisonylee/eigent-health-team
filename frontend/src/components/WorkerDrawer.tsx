import { ROLE_LABEL, useStore } from "../store";

/** Side drawer revealing everything about a worker — prompt, output, tools, usage. */
export default function WorkerDrawer() {
  const role = useStore((s) => s.expandedRole);
  const workers = useStore((s) => s.workers);
  const prompts = useStore((s) => s.prompts);
  const setExpanded = useStore((s) => s.setExpanded);

  if (!role) return null;
  const worker = workers[role];
  const prompt = prompts?.[role] || "(system prompt not loaded)";
  const tokens = worker.promptTokens + worker.completionTokens;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-stone-900/30 backdrop-blur-sm"
      onClick={() => setExpanded(null)}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-stone-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-stone-400">
              Worker
            </div>
            <h2 className="font-serif text-xl text-stone-900">
              {ROLE_LABEL[role]}
            </h2>
          </div>
          <button
            onClick={() => setExpanded(null)}
            className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-200 hover:text-stone-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Status
            </h3>
            <div className="mt-1.5 flex gap-4 font-mono text-xs text-stone-700">
              <span>
                <span className="text-stone-400">state:</span>{" "}
                {worker.status}
              </span>
              <span>
                <span className="text-stone-400">tokens:</span>{" "}
                {tokens.toLocaleString()}{" "}
                <span className="text-stone-400">
                  ({worker.promptTokens.toLocaleString()} in /{" "}
                  {worker.completionTokens.toLocaleString()} out)
                </span>
              </span>
              <span>
                <span className="text-stone-400">cost:</span> $
                {worker.cost.toFixed(4)}
              </span>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              System prompt
            </h3>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-3 font-mono text-[11px] leading-snug text-stone-700">
              {prompt}
            </pre>
          </section>

          {worker.toolCalls.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Tool calls ({worker.toolCalls.length})
              </h3>
              <ol className="mt-1.5 space-y-1.5">
                {worker.toolCalls.map((tc, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 font-mono text-[11px] text-sky-900"
                  >
                    <span className="text-sky-600">{tc.name}</span>(
                    <span className="text-sky-800">"{tc.query}"</span>)
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Streamed output
            </h3>
            <pre className="mt-1.5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-3 font-mono text-[11px] leading-snug text-stone-700">
              {worker.text || "(nothing streamed yet)"}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}
