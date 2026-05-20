import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/Card";

interface EvalRow {
  ts: string;
  profile: string;
  coherence: number;
  actionability: number;
  safety: number;
  personalization: number;
  one_line_summary: string;
}

interface EvalsResponse {
  rows: EvalRow[];
  means: Record<string, number>;
}

export default function Evals() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["evals"],
    queryFn: async () => {
      const r = await fetch("/api/evals");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as EvalsResponse;
    },
  });

  return (
    <div>
      <p className="mb-5 text-body text-slate-gray">
          LLM-as-judge scores from{" "}
          <code className="rounded bg-paper-white/10 px-1 text-ink-black">
            evals/results.csv
          </code>
          . Run{" "}
          <code className="rounded bg-paper-white/10 px-1 text-ink-black">
            uv run python -m evals.llm_judge
          </code>{" "}
          to append fresh scores.
        </p>

        {isLoading && (
          <div className="text-body text-slate-gray">loading…</div>
        )}
        {error && (
          <div className="rounded-default border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
            {String(error)}
          </div>
        )}

        {data && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(data.means).map(([criterion, mean]) => (
                <Card key={criterion} surface="starless" shape="default">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
                    {criterion}
                  </div>
                  <div className="mt-1 text-heading font-semibold text-ink-black">
                    {mean.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-gray">mean / 5</div>
                </Card>
              ))}
            </div>

            {/* Per the design system's "rhythmic contrast" rule: the evals
                table is a Frost (white) card inside the dark canvas — dense
                tabular reading content. */}
            <div className="overflow-hidden rounded-card bg-paper-white shadow-card">
              <table className="w-full text-body">
                <thead className="bg-stone-100 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">When</th>
                    <th className="px-4 py-2.5 text-left">Profile</th>
                    <th className="px-4 py-2.5 text-right">Coh.</th>
                    <th className="px-4 py-2.5 text-right">Act.</th>
                    <th className="px-4 py-2.5 text-right">Saf.</th>
                    <th className="px-4 py-2.5 text-right">Pers.</th>
                    <th className="px-4 py-2.5 text-left">Summary</th>
                  </tr>
                </thead>
                <tbody className="text-stone-800">
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-t border-stone-200">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-stone-500">
                        {r.ts}
                      </td>
                      <td className="px-4 py-2.5 text-[12px]">{r.profile}</td>
                      <td className="px-4 py-2.5 text-right">{r.coherence}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.actionability}
                      </td>
                      <td className="px-4 py-2.5 text-right">{r.safety}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.personalization}
                      </td>
                      <td className="px-4 py-2.5 text-[12px]">
                        {r.one_line_summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-stone-400">
                  No eval rows yet.
                </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
