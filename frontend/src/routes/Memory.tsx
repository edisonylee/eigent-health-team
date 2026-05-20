import { useMemo } from "react";

import { Card } from "../components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { useEvents } from "../lib/queries";

import MemoryGraph from "./MemoryGraph";
import Profile from "./Profile";

/** Memory — what the system knows about you.
 *
 *  Three tabs:
 *    - About me  : the rolling synthesis (read-only, refreshes after each
 *                  check-in or completed run).
 *    - Graph     : the entity graph extracted from your data, with its
 *                  source documents inlined directly beneath the viz.
 *    - History   : full retroactive event log.
 *
 *  Provenance ("what feeds the graph") lives under the Graph tab as an
 *  inline section of MemoryGraph itself — sources belong with the viz.
 */
export default function Memory() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-heading font-semibold text-ink-black">Memory</h1>
          <p className="mt-1 text-body text-slate-gray">
            What the system knows about you. Everything here is consumed by the
            next plan.
          </p>
        </header>

        <Tabs defaultValue="about">
          <TabsList className="mb-6">
            <TabsTrigger value="about">About me</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="about">
            {/* Profile owns its own page chrome. */}
            <Profile />
          </TabsContent>
          <TabsContent value="graph">
            <MemoryGraph />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HistoryPanel() {
  // Full event log, grouped by month. Limit at 500 — these accumulate slowly
  // since they're hand-logged.
  const { data, isLoading } = useEvents({ limit: 500 });

  const grouped = useMemo(() => {
    const m = new Map<string, typeof data>();
    for (const e of data || []) {
      const ym = e.day.slice(0, 7);
      const arr = m.get(ym) || [];
      arr.push(e);
      m.set(ym, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (isLoading) {
    return <div className="text-body text-slate-gray">loading…</div>;
  }
  if (!data || data.length === 0) {
    return (
      <Card surface="starless" className="text-body text-slate-gray">
        No events logged yet. Use the calendar on Today to add some.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([ym, events]) => (
        <section key={ym}>
          <h2 className="mb-2 text-subheading font-medium text-ink-black">
            {monthLabel(ym)}{" "}
            <span className="font-mono text-[11px] text-silver-mist">
              · {events!.length} event{events!.length === 1 ? "" : "s"}
            </span>
          </h2>
          <ul className="space-y-1.5">
            {events!.map((e) => (
              <li
                key={e.id}
                className="rounded-default border border-frost-gray bg-paper-white px-3 py-2 text-[12px]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-stone-gray">{e.day}</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-silver-mist">
                    {e.category}
                  </span>
                </div>
                {e.description && (
                  <div className="mt-1 text-slate-gray">{e.description}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map((n) => parseInt(n, 10));
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
