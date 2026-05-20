import { useStore } from "../store";

const FLAG_STYLE: Record<string, string> = {
  low: "bg-amber-50 border-amber-200 text-amber-900",
  high: "bg-amber-50 border-amber-200 text-amber-900",
  normal: "bg-emerald-50 border-emerald-200 text-emerald-900",
  unknown: "bg-stone-50 border-stone-200 text-stone-700",
};

const FLAG_BADGE: Record<string, string> = {
  low: "bg-amber-200 text-amber-900",
  high: "bg-amber-200 text-amber-900",
  normal: "bg-emerald-200 text-emerald-900",
  unknown: "bg-stone-200 text-stone-700",
};

/** Persistent row of parsed biomarkers — visible while the agents work. */
export default function BiomarkerTable() {
  const panel = useStore((s) => s.labPanel);
  const setLabPanel = useStore((s) => s.setLabPanel);

  if (!panel || panel.biomarkers.length === 0) return null;

  const meta = [panel.lab_name, panel.date].filter(Boolean).join(" · ");

  return (
    <div className="mb-5 rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <h3 className="font-serif text-base text-stone-900">Lab values</h3>
          {meta && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
              {meta}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLabPanel(null)}
          className="text-[11px] text-stone-500 hover:text-stone-800"
        >
          remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {panel.biomarkers.map((b, i) => {
          const style = FLAG_STYLE[b.flag] || FLAG_STYLE.unknown;
          const badge = FLAG_BADGE[b.flag] || FLAG_BADGE.unknown;
          return (
            <div
              key={i}
              className={`rounded-md border px-2.5 py-1.5 ${style}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-stone-800">
                  {b.name}
                </span>
                {b.flag !== "unknown" && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] uppercase ${badge}`}
                  >
                    {b.flag}
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[12px] text-stone-900">
                {b.value}
                {b.unit ? <span className="ml-1 text-stone-500">{b.unit}</span> : null}
              </div>
              {b.reference_range && (
                <div className="font-mono text-[9px] text-stone-400">
                  ref {b.reference_range}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
