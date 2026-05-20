import { useStore } from "../store";
import { Badge } from "./ui/Badge";

const FLAG_TONE: Record<string, "neutral" | "gold" | "green"> = {
  low: "gold",
  high: "gold",
  normal: "green",
  unknown: "neutral",
};

const FLAG_BORDER: Record<string, string> = {
  low: "border-fire-orange/40",
  high: "border-fire-orange/40",
  normal: "border-status-done/40",
  unknown: "border-frost-gray",
};

/** Persistent row of parsed biomarkers — visible while the agents work. */
export default function BiomarkerTable() {
  const panel = useStore((s) => s.labPanel);
  const setLabPanel = useStore((s) => s.setLabPanel);

  if (!panel || panel.biomarkers.length === 0) return null;

  const meta = [panel.lab_name, panel.date].filter(Boolean).join(" · ");

  return (
    <div className="mb-5 rounded-card border border-frost-gray bg-paper-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-subheading font-medium text-ink-black">Lab values</h3>
          {meta && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-gray">
              {meta}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLabPanel(null)}
          className="text-[11px] text-slate-gray hover:text-ink-black"
        >
          remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {panel.biomarkers.map((b, i) => (
          <div
            key={i}
            className={`rounded-default border bg-cloud-canvas px-3 py-2 ${FLAG_BORDER[b.flag] || FLAG_BORDER.unknown}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-ink-black">
                {b.name}
              </span>
              {b.flag !== "unknown" && (
                <Badge tone={FLAG_TONE[b.flag] || "neutral"}>{b.flag}</Badge>
              )}
            </div>
            <div className="mt-1 font-mono text-[13px] text-ink-black">
              {b.value}
              {b.unit ? (
                <span className="ml-1 text-slate-gray">{b.unit}</span>
              ) : null}
            </div>
            {b.reference_range && (
              <div className="font-mono text-[9px] text-slate-gray">
                ref {b.reference_range}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
