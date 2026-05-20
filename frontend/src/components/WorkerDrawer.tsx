import { ROLE_LABEL, useStore } from "../store";
import { Badge } from "./ui/Badge";

/** Split streamed text into the (## Reasoning, ## Conclusion) parts when present. */
function splitReasoning(text: string): { reasoning: string; rest: string } {
  if (!text) return { reasoning: "", rest: "" };
  const lower = text.toLowerCase();
  const rIdx = lower.indexOf("## reasoning");
  if (rIdx === -1) return { reasoning: "", rest: text };
  const after = rIdx + "## reasoning".length;
  const cIdx = lower.indexOf("## conclusion", after);
  if (cIdx === -1) {
    return { reasoning: text.slice(after).trim(), rest: "" };
  }
  return {
    reasoning: text.slice(after, cIdx).trim(),
    rest: text.slice(cIdx + "## conclusion".length).trim(),
  };
}

const TOOL_BADGE: Record<string, "purple" | "teal" | "sky"> = {
  search_health_kb: "purple",
  query_health_graph: "teal",
  search_duckduckgo: "sky",
  search_brave: "sky",
};

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
      className="fixed inset-0 z-40 flex justify-end bg-midnight-eclipse/70 backdrop-blur-sm"
      onClick={() => setExpanded(null)}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-twilight-ink bg-starless-night shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-twilight-ink bg-starless-night/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-flare">
              Worker
            </div>
            <h2 className="text-heading-sm font-semibold text-frost">
              {ROLE_LABEL[role]}
            </h2>
          </div>
          <button
            onClick={() => setExpanded(null)}
            className="rounded-default p-1.5 text-slate-gray hover:bg-frost/5 hover:text-frost"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-gray">
              Status
            </h3>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[12px]">
              <span>
                <span className="text-slate-gray">state:</span>{" "}
                <span className="text-frost">{worker.status}</span>
              </span>
              <span>
                <span className="text-slate-gray">tokens:</span>{" "}
                <span className="text-frost">{tokens.toLocaleString()}</span>{" "}
                <span className="text-slate-gray">
                  ({worker.promptTokens.toLocaleString()} in /{" "}
                  {worker.completionTokens.toLocaleString()} out)
                </span>
              </span>
              <span>
                <span className="text-slate-gray">cost:</span>{" "}
                <span className="text-frost">${worker.cost.toFixed(4)}</span>
              </span>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-gray">
              System prompt
            </h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-default border border-twilight-ink bg-midnight-eclipse p-3 font-mono text-[11px] leading-snug text-ghostly-gray">
              {prompt}
            </pre>
          </section>

          {worker.toolCalls.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-gray">
                Tool calls ({worker.toolCalls.length})
              </h3>
              <ol className="mt-2 space-y-2">
                {worker.toolCalls.map((tc, i) => {
                  const tone = TOOL_BADGE[tc.name] ?? "neutral";
                  return (
                    <li
                      key={i}
                      className="rounded-default border border-twilight-ink bg-midnight-eclipse px-3 py-2 font-mono text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={tone}>{tc.name}</Badge>
                        <span className="text-ghostly-gray/70">
                          "{tc.query}"
                        </span>
                      </div>
                      {tc.sources && tc.sources.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-magenta-burst/40 pl-2">
                          {tc.sources.map((s, j) => (
                            <li key={j} className="text-[10px]">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-magenta-burst underline-offset-2 hover:underline"
                              >
                                {s.title || s.url}
                              </a>{" "}
                              <span className="text-slate-gray">
                                ({s.score.toFixed(3)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {tc.entities && tc.entities.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-teal-glow/40 pl-2">
                          {tc.entities.map((ent, j) => (
                            <li
                              key={j}
                              className="text-[10px] text-ghostly-gray"
                            >
                              <span className="font-semibold text-teal-glow">
                                {ent.name}
                              </span>
                              <span className="text-slate-gray"> · {ent.type}</span>{" "}
                              <span className="text-slate-gray">
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
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-flare">
                Reasoning trace
              </h3>
              <pre className="mt-2 whitespace-pre-wrap rounded-default border border-fuchsia-flare/30 bg-fuchsia-flare/5 p-3 font-mono text-[11px] leading-snug text-ghostly-gray">
                {reasoning}
              </pre>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-gray">
              {reasoning ? "Conclusion" : "Streamed output"}
            </h3>
            <pre className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-default border border-twilight-ink bg-midnight-eclipse p-3 font-mono text-[11px] leading-snug text-ghostly-gray">
              {(reasoning ? rest : worker.text) || "(nothing streamed yet)"}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}
