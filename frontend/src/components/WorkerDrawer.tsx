import { ROLE_LABEL, useStore } from "../store";

/** Split streamed text into the (## Reasoning, ## Conclusion) parts when present. */
function splitReasoning(text: string): { reasoning: string; rest: string } {
  if (!text) return { reasoning: "", rest: "" };
  const lower = text.toLowerCase();
  const rIdx = lower.indexOf("## reasoning");
  if (rIdx === -1) return { reasoning: "", rest: text };
  const after = rIdx + "## reasoning".length;
  const cIdx = lower.indexOf("## conclusion", after);
  if (cIdx === -1) {
    // Conclusion hasn't streamed in yet — reasoning runs to current end.
    return { reasoning: text.slice(after).trim(), rest: "" };
  }
  return {
    reasoning: text.slice(after, cIdx).trim(),
    rest: text.slice(cIdx + "## conclusion".length).trim(),
  };
}

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
  const { reasoning, rest } = splitReasoning(worker.text);

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
              <ol className="mt-1.5 space-y-2">
                {worker.toolCalls.map((tc, i) => {
                  const isKB = tc.name === "search_health_kb";
                  const isGraph = tc.name === "query_health_graph";
                  const style = isGraph
                    ? "border-teal-200 bg-teal-50 text-teal-900"
                    : isKB
                      ? "border-violet-200 bg-violet-50 text-violet-900"
                      : "border-sky-200 bg-sky-50 text-sky-900";
                  const labelColor = isGraph
                    ? "text-teal-600"
                    : isKB
                      ? "text-violet-600"
                      : "text-sky-600";
                  const queryColor = isGraph
                    ? "text-teal-800"
                    : isKB
                      ? "text-violet-800"
                      : "text-sky-800";
                  const icon = isGraph ? "🕸️ " : isKB ? "📚 " : "🌐 ";

                  return (
                    <li
                      key={i}
                      className={`rounded-md border px-3 py-2 font-mono text-[11px] ${style}`}
                    >
                      <div>
                        <span className={labelColor}>
                          {icon}
                          {tc.name}
                        </span>
                        (
                        <span className={queryColor}>"{tc.query}"</span>)
                      </div>
                      {tc.sources && tc.sources.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-violet-300 pl-2">
                          {tc.sources.map((s, j) => (
                            <li key={j} className="text-[10px]">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-violet-700 underline hover:text-violet-900"
                              >
                                {s.title || s.url}
                              </a>{" "}
                              <span className="text-violet-500">
                                ({s.score.toFixed(3)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {tc.entities && tc.entities.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-teal-300 pl-2">
                          {tc.entities.map((ent, j) => (
                            <li key={j} className="text-[10px] text-teal-800">
                              <span className="font-semibold text-teal-900">
                                {ent.name}
                              </span>
                              <span className="text-teal-500"> · {ent.type}</span>{" "}
                              <span className="text-teal-500">
                                ({ent.edge_count} edges · {ent.score.toFixed(3)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {reasoning && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
                💭 Reasoning trace
              </h3>
              <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-violet-200 bg-violet-50 p-3 font-mono text-[11px] leading-snug text-violet-900">
                {reasoning}
              </pre>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {reasoning ? "Conclusion" : "Streamed output"}
            </h3>
            <pre className="mt-1.5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-3 font-mono text-[11px] leading-snug text-stone-700">
              {(reasoning ? rest : worker.text) || "(nothing streamed yet)"}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}
