// Stacked-bar 28-day trend strip showing per-category event counts.
// Sits directly under the CalendarStrip — the two share the same window
// computed by `calendarWindow()` so a bar lines up with its calendar cell.
//
// Hover a day → tooltip with that day's per-category breakdown.

import { useMemo, useState } from "react";
import { EVENT_CATEGORIES, EventCategory } from "../lib/api";
import { useCategoryCounts } from "../lib/queries";
import { CATEGORY_COLOR, calendarWindow } from "./CalendarStrip";

const CATEGORY_LABEL: Record<EventCategory, string> = {
  symptom: "Symptom",
  meal: "Meal",
  sleep: "Sleep",
  exercise: "Exercise",
  supplement: "Supplement",
  medication: "Medication",
  mood: "Mood",
  note: "Note",
};

// Fill colors used inline (SVG <rect>) — mirrors CATEGORY_COLOR tailwind classes.
const CATEGORY_FILL: Record<EventCategory, string> = {
  symptom: "var(--color-crimson-red)",
  meal: "var(--color-sunset-orange)",
  sleep: "var(--color-sky-blue)",
  exercise: "var(--color-vivid-green)",
  supplement: "var(--color-teal-glow)",
  medication: "var(--color-magenta-burst)",
  mood: "var(--color-goldenrod)",
  note: "var(--color-pewter)",
};

export default function TrendChart() {
  const { start, end, days } = useMemo(() => calendarWindow(), []);
  const { data: counts } = useCategoryCounts(start, end);
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set());
  const [hover, setHover] = useState<string | null>(null);

  // Pivot to day -> category -> n.
  const byDay = useMemo(() => {
    const m = new Map<string, Map<EventCategory, number>>();
    for (const r of counts || []) {
      const inner = m.get(r.day) || new Map<EventCategory, number>();
      inner.set(r.category, (inner.get(r.category) || 0) + r.n);
      m.set(r.day, inner);
    }
    return m;
  }, [counts]);

  // Day totals (after applying filter) — used to size bar heights.
  const dayTotal = (day: string): number => {
    const inner = byDay.get(day);
    if (!inner) return 0;
    let total = 0;
    for (const [cat, n] of inner.entries()) {
      if (!hidden.has(cat)) total += n;
    }
    return total;
  };

  const max = Math.max(1, ...days.map(dayTotal));
  // Per-day total across the visible window — small headline number.
  const windowTotal = days.reduce((a, d) => a + dayTotal(d), 0);

  return (
    <div className="mb-5 rounded-card border border-twilight-ink bg-starless-night/60 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-gray">
            Trend · per-category counts
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-pewter">
            {windowTotal} event{windowTotal === 1 ? "" : "s"} across 28 days
          </div>
        </div>
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={() => setHidden(new Set())}
            className="rounded-pill border border-ghostly-gray/40 px-3 py-1 text-[11px] text-frost hover:bg-frost/5"
          >
            Show all
          </button>
        )}
      </div>

      <svg
        viewBox="0 0 280 64"
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label="28-day stacked event counts"
        onMouseLeave={() => setHover(null)}
      >
        {days.map((day, i) => {
          const inner = byDay.get(day);
          const x = i * 10 + 0.5; // 9px-wide bar + 1px gap inside 280 viewBox
          const total = dayTotal(day);
          if (total === 0) {
            // Empty-day baseline tick.
            return (
              <rect
                key={day}
                x={x}
                y={62}
                width={9}
                height={1}
                fill="var(--color-twilight-ink)"
                onMouseEnter={() => setHover(day)}
              />
            );
          }
          let cursor = 60;
          const segs = EVENT_CATEGORIES.flatMap((cat) => {
            if (hidden.has(cat)) return [];
            const n = inner?.get(cat) || 0;
            if (n === 0) return [];
            const h = (n / max) * 56;
            cursor -= h;
            return [
              <rect
                key={`${day}-${cat}`}
                x={x}
                y={cursor}
                width={9}
                height={h}
                fill={CATEGORY_FILL[cat]}
                opacity={hover && hover !== day ? 0.45 : 0.95}
              />,
            ];
          });
          return (
            <g key={day} onMouseEnter={() => setHover(day)}>
              {segs}
              {/* invisible hit-target spans the full column height */}
              <rect
                x={x - 0.5}
                y={0}
                width={10}
                height={62}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>

      {/* Hover detail line — keeps the surface compact instead of a popover */}
      <div className="mt-1 min-h-[18px] font-mono text-[11px] text-pewter">
        {hover ? (
          <HoverDetail day={hover} inner={byDay.get(hover)} hidden={hidden} />
        ) : (
          <span className="text-pewter/70">hover a day for a breakdown</span>
        )}
      </div>

      {/* Legend / filter — click to toggle a category */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EVENT_CATEGORIES.map((cat) => {
          const off = hidden.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat);
                  else next.add(cat);
                  return next;
                })
              }
              className={
                "flex items-center gap-1.5 rounded-pill border px-2 py-0.5 " +
                "text-[10px] transition-[opacity,border-color] " +
                (off
                  ? "border-twilight-ink text-slate-gray opacity-60"
                  : "border-ghostly-gray/30 text-frost hover:bg-frost/5")
              }
              title={off ? `Show ${cat}` : `Hide ${cat}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${CATEGORY_COLOR[cat]} ${off ? "opacity-40" : ""}`}
              />
              {CATEGORY_LABEL[cat]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HoverDetail({
  day,
  inner,
  hidden,
}: {
  day: string;
  inner: Map<EventCategory, number> | undefined;
  hidden: Set<EventCategory>;
}) {
  const total = inner
    ? Array.from(inner.entries()).reduce(
        (a, [c, n]) => a + (hidden.has(c) ? 0 : n),
        0,
      )
    : 0;
  if (total === 0) {
    return (
      <span>
        <span className="text-frost">{day}</span> · no events
      </span>
    );
  }
  const parts = EVENT_CATEGORIES.filter(
    (c) => !hidden.has(c) && (inner?.get(c) || 0) > 0,
  ).map((c) => `${c} ${inner!.get(c)}`);
  return (
    <span>
      <span className="text-frost">{day}</span> · {parts.join(" · ")}
    </span>
  );
}
