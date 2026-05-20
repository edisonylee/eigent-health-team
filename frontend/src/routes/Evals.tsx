import { useQuery } from "@tanstack/react-query";

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
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-serif text-2xl text-stone-900">
          Evals dashboard
        </h1>
        <p className="mb-5 text-sm text-stone-500">
          LLM-as-judge scores from{" "}
          <code className="rounded bg-stone-100 px-1">evals/results.csv</code>.
          Run{" "}
          <code className="rounded bg-stone-100 px-1">uv run python -m evals.llm_judge</code>{" "}
          to append fresh scores.
        </p>

        {isLoading && (
          <div className="text-sm text-stone-500">loading…</div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {String(error)}
          </div>
        )}

        {data && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(data.means).map(([criterion, mean]) => (
                <div
                  key={criterion}
                  className="rounded-md border border-stone-200 bg-white p-3"
                >
                  <div className="text-[10px] uppercase tracking-wider text-stone-400">
                    {criterion}
                  </div>
                  <div className="font-serif text-2xl text-stone-900">
                    {mean.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-stone-500">mean / 5</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Profile</th>
                    <th className="px-3 py-2 text-right">Coh.</th>
                    <th className="px-3 py-2 text-right">Act.</th>
                    <th className="px-3 py-2 text-right">Saf.</th>
                    <th className="px-3 py-2 text-right">Pers.</th>
                    <th className="px-3 py-2 text-left">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-mono text-[11px] text-stone-500">
                        {r.ts}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-700">
                        {r.profile}
                      </td>
                      <td className="px-3 py-2 text-right">{r.coherence}</td>
                      <td className="px-3 py-2 text-right">{r.actionability}</td>
                      <td className="px-3 py-2 text-right">{r.safety}</td>
                      <td className="px-3 py-2 text-right">{r.personalization}</td>
                      <td className="px-3 py-2 text-xs text-stone-600">
                        {r.one_line_summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-stone-400">
                  No eval rows yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
