import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

import type { MemoryGraphNode } from "../lib/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/cn";
import {
  useEntityMentions,
  useMemoryGraph,
  useMemoryGraphSources,
  useReindexMemoryGraph,
} from "../lib/queries";
import { useStore } from "../store";

// Per-type styling — colors drawn from the design system accents so the
// graph integrates with the dark theme.
const TYPE_STYLE: Record<string, { color: string; label: string }> = {
  nutrient:   { color: "#B855E7", label: "Nutrient" },     // magenta burst
  condition:  { color: "#FF5252", label: "Condition" },    // crimson red
  provider:   { color: "#60A5FA", label: "Provider" },     // sky blue
  medication: { color: "#FFB764", label: "Medication" },   // fire-orange
  food:       { color: "#16C253", label: "Food" },         // vivid green
  place:      { color: "#999999", label: "Place" },        // silver-mist
  person:     { color: "#DD55E7", label: "Person" },       // fuchsia flare
  activity:   { color: "#1CECBB", label: "Activity" },     // teal glow
  biomarker:  { color: "#0088FF", label: "Biomarker" },    // electric blue
  exercise:   { color: "#FFDD00", label: "Exercise" },     // sunshine yellow
  observation:{ color: "#F472B6", label: "Observation" },  // sleep/energy/mood bucket
  other:      { color: "#70757C", label: "Other" },        // slate gray
};

const DEFAULT_STYLE = { color: "#70757C", label: "Other" };

function styleFor(type: string) {
  return TYPE_STYLE[type] || DEFAULT_STYLE;
}

export default function MemoryGraph() {
  const password = useStore((s) => s.password);
  const { data, isLoading, error } = useMemoryGraph();
  const reindex = useReindexMemoryGraph();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const fgRef = useRef<any>(null);
  const { data: detail } = useEntityMentions(selectedId);

  const filtered = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    if (typeFilter.size === 0) return data;
    const keep = new Set(
      data.nodes.filter((n) => typeFilter.has(n.type)).map((n) => n.id),
    );
    return {
      nodes: data.nodes.filter((n) => keep.has(n.id)),
      links: data.links.filter(
        (l) => keep.has(l.source as number) && keep.has(l.target as number),
      ),
    };
  }, [data, typeFilter]);

  const types = useMemo(() => {
    if (!data) return [] as string[];
    const seen = new Set<string>();
    for (const n of data.nodes) seen.add(n.type);
    return Array.from(seen).sort();
  }, [data]);

  const onNodeClick = useCallback((node: any) => {
    setSelectedId(node.id);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(2.5, 600);
    }
  }, []);

  const toggleType = (t: string) =>
    setTypeFilter((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  // Light text on a dark canvas — frost labels at higher zoom.
  const drawNode = useCallback(
    (n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const radius = Math.max(4, 4 + Math.log2(1 + (n.mention_count || 1)) * 2);
      const { color } = styleFor(n.type);
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      if (n.canonical_id) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      }
      if (globalScale >= 1.2) {
        ctx.font = `${10 / globalScale}px Inter, ui-sans-serif`;
        ctx.fillStyle = "#E5E7EB";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.name, n.x, n.y + radius + 2);
      }
    },
    [],
  );

  const reindexNow = (clear: boolean) =>
    reindex.mutate({ password, clear });

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-heading font-semibold text-ink-black">
              Memory Graph
            </h1>
            <p className="mt-1 text-body text-slate-gray">
              Entities the system has extracted from your plans, check-ins,
              labs, and profile. Canonical entities (ringed) link back to the
              curated health graph.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => reindexNow(false)}
              disabled={reindex.isPending}
            >
              {reindex.isPending ? "Reindexing…" : "Reindex"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="button"
              onClick={() => reindexNow(true)}
              disabled={reindex.isPending}
              title="Wipe both tables and re-extract from scratch"
            >
              Reset + reindex
            </Button>
          </div>
        </header>

        {types.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-gray">Filter:</span>
            {types.map((t) => {
              const { color, label } = styleFor(t);
              const active = typeFilter.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 transition-colors",
                    active
                      ? "border-cloud-canvas bg-paper-white text-cloud-canvas"
                      : "border-frost-gray bg-paper-white/5 text-stone-gray hover:bg-paper-white/10",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </button>
              );
            })}
            {typeFilter.size > 0 && (
              <button
                type="button"
                onClick={() => setTypeFilter(new Set())}
                className="text-slate-gray underline-offset-2 hover:underline hover:text-ink-black"
              >
                clear
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-[640px] w-full overflow-hidden rounded-card border border-frost-gray bg-paper-white">
            {isLoading && (
              <div className="flex h-full items-center justify-center text-body text-slate-gray">
                Loading…
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center text-body text-status-error">
                {String(error)}
              </div>
            )}
            {!isLoading && data && data.nodes.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-body text-slate-gray">
                <p>No entities yet. Run a plan or hit Reindex to seed the graph.</p>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => reindexNow(false)}
                  disabled={reindex.isPending}
                >
                  Reindex now
                </Button>
              </div>
            )}
            {!isLoading && filtered.nodes.length > 0 && (
              <ForceGraph2D
                ref={fgRef}
                graphData={filtered}
                nodeId="id"
                nodeLabel={(n: any) =>
                  `${n.name} · ${n.type} · ${n.mention_count} mention${n.mention_count === 1 ? "" : "s"}`
                }
                nodeCanvasObject={drawNode}
                nodePointerAreaPaint={(n: any, color: string, ctx: any) => {
                  ctx.fillStyle = color;
                  const radius = Math.max(
                    6,
                    6 + Math.log2(1 + (n.mention_count || 1)) * 2,
                  );
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
                  ctx.fill();
                }}
                linkColor={() => "#1c1d1f"}
                linkWidth={(l: any) => Math.max(0.5, Math.log2(1 + l.value))}
                onNodeClick={onNodeClick}
                cooldownTicks={120}
                d3AlphaDecay={0.025}
                d3VelocityDecay={0.45}
                backgroundColor="#030719"
              />
            )}
          </div>

          <Card surface="starless" className="self-start">
            {detail && detail.entity ? (
              <EntityDetailPanel
                node={detail.entity}
                mentions={detail.mentions}
              />
            ) : (
              <div className="space-y-3 text-body text-slate-gray">
                <p>Click any node to see its mentions.</p>
                <p>
                  Node size reflects mention count. A white ring means the
                  entity matched a canonical node in the health graph.
                </p>
                {data && (
                  <p className="font-mono text-[11px] text-silver-mist">
                    {data.nodes.length} nodes · {data.links.length} edges
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <SourcesSection />
      </div>
    </div>
  );
}

/** Raw source documents that feed the graph. Lives under the viz so the
 * user can trust-but-verify: every entity above came out of something
 * concrete that lives in this list. */
function SourcesSection() {
  const { data, isLoading } = useMemoryGraphSources();
  const [tab, setTab] = useState<
    "check_ins" | "run_memos" | "biomarkers" | "profile"
  >("check_ins");

  if (isLoading || !data) {
    return (
      <div className="mt-8 text-body text-slate-gray">Loading sources…</div>
    );
  }

  const counts = {
    check_ins: data.check_ins.length,
    run_memos: data.run_memos.length,
    biomarkers: data.biomarkers.length,
    profile: data.profile.notes ? 1 : 0,
  };

  const tabs: { key: typeof tab; label: string; n: number }[] = [
    { key: "check_ins", label: "Check-ins", n: counts.check_ins },
    { key: "run_memos", label: "Run memos", n: counts.run_memos },
    { key: "biomarkers", label: "Biomarkers", n: counts.biomarkers },
    { key: "profile", label: "Profile synthesis", n: counts.profile },
  ];

  return (
    <section className="mt-10">
      <h2 className="text-subheading font-medium text-ink-black">
        Sources feeding the graph
      </h2>
      <p className="mt-1 text-body text-slate-gray">
        The raw text the indexer extracted entities from. Every node above
        traces back to one or more of these documents.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 transition-colors",
                active
                  ? "border-ink-black bg-ink-black text-paper-white"
                  : "border-frost-gray bg-paper-white/5 text-stone-gray hover:bg-paper-white/10",
              )}
            >
              <span>{t.label}</span>
              <span className="font-mono text-silver-mist">{t.n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {tab === "check_ins" && <CheckInList rows={data.check_ins} />}
        {tab === "run_memos" && <RunMemoList rows={data.run_memos} />}
        {tab === "biomarkers" && <BiomarkerList rows={data.biomarkers} />}
        {tab === "profile" && <ProfileBlock profile={data.profile} />}
      </div>
    </section>
  );
}

function CheckInList({
  rows,
}: {
  rows: import("../lib/api").CheckIn[];
}) {
  if (rows.length === 0) {
    return <div className="text-body text-silver-mist">No check-ins yet.</div>;
  }
  return (
    <ol className="space-y-2">
      {rows.map((c) => (
        <li
          key={c.id}
          className="rounded-card border border-frost-gray bg-paper-white p-3"
        >
          <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-slate-gray">
            <span className="text-ink-black">{c.day}</span>
            <span className="text-silver-mist">
              {[
                c.energy != null ? `energy ${c.energy}/5` : null,
                c.sleep_hours != null ? `${c.sleep_hours}h sleep` : null,
                c.mood != null ? `mood ${c.mood}/5` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "no stats"}
            </span>
          </div>
          {c.adherence_notes ? (
            <p className="mt-1.5 text-body text-stone-gray">
              {c.adherence_notes}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] italic text-silver-mist">
              (no notes)
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function RunMemoList({
  rows,
}: {
  rows: import("../lib/api").MemoryGraphSources["run_memos"];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-body text-silver-mist">
        No completed runs yet. Submit an idea on the Run page.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.task_id}
          className="rounded-card border border-frost-gray bg-paper-white p-3"
        >
          <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-slate-gray">
            <span className="text-ink-black">
              {r.idea || <em className="text-silver-mist">untitled</em>}
            </span>
            <a
              href={`/runs/${r.task_id}/timeline`}
              className="text-silver-mist underline-offset-2 hover:text-ink-black hover:underline"
            >
              {formatTsShort(r.started_at)} → timeline ↗
            </a>
          </div>
          {r.memo && (
            <p className="mt-1.5 line-clamp-4 text-body text-stone-gray">
              {r.memo}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function BiomarkerList({
  rows,
}: {
  rows: import("../lib/api").BiomarkerRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-body text-silver-mist">
        No labs yet. Upload a PDF or paste lab text on the Run page.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-frost-gray bg-paper-white">
      <table className="w-full text-body">
        <thead className="bg-cloud-canvas/60 text-[10px] uppercase tracking-[0.2em] text-silver-mist">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-right">Value</th>
            <th className="px-4 py-2 text-left">Flag</th>
            <th className="px-4 py-2 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={`${b.name}-${b.recorded_at}`} className="border-t border-frost-gray">
              <td className="px-4 py-2 text-ink-black">{b.name}</td>
              <td className="px-4 py-2 text-right font-mono text-[12px] text-ink-black">
                {b.value}
                {b.unit ? ` ${b.unit}` : ""}
              </td>
              <td className="px-4 py-2 text-[12px]">
                <FlagPill flag={b.flag} />
              </td>
              <td className="px-4 py-2 text-right font-mono text-[11px] text-stone-gray">
                {formatTsShort(b.recorded_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfileBlock({
  profile,
}: {
  profile: import("../lib/api").ProfileSynthesis;
}) {
  if (!profile.notes) {
    return (
      <div className="text-body text-silver-mist">
        No synthesis yet. Visit the{" "}
        <a
          href="/profile"
          className="text-ink-black underline-offset-2 hover:underline"
        >
          Profile
        </a>{" "}
        page to seed it.
      </div>
    );
  }
  return (
    <div className="rounded-card border border-frost-gray bg-paper-white p-4">
      <div className="mb-2 font-mono text-[11px] text-silver-mist">
        {profile.synthesized_at
          ? `synthesized ${formatTsShort(profile.synthesized_at)}`
          : "—"}
        {" · "}from {profile.check_ins} check-ins, {profile.run_memos} run
        memos, {profile.biomarkers} biomarkers
      </div>
      <p className="whitespace-pre-wrap text-body text-stone-gray">
        {profile.notes}
      </p>
    </div>
  );
}

function FlagPill({ flag }: { flag: string | null }) {
  const f = (flag || "").toLowerCase();
  const tone =
    f === "high" || f === "low"
      ? "bg-status-error/10 text-status-error border-status-error/30"
      : f === "normal"
        ? "bg-status-success/10 text-status-success border-status-success/30"
        : "border-frost-gray bg-paper-white/5 text-silver-mist";
  return (
    <span
      className={cn(
        "inline-block rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tone,
      )}
    >
      {flag || "—"}
    </span>
  );
}

function formatTsShort(ts: number | null | undefined): string {
  if (ts == null) return "—";
  try {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function EntityDetailPanel({
  node,
  mentions,
}: {
  node: MemoryGraphNode;
  mentions: import("../lib/api").EntityMention[];
}) {
  const { color, label } = styleFor(node.type);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
          {label}
        </span>
      </div>
      <h2 className="text-subheading font-semibold text-ink-black">{node.name}</h2>
      {node.canonical_id && (
        <div className="mt-1.5">
          <Badge tone="teal">canonical: {node.canonical_id}</Badge>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-gray">
        <div>
          <dt className="text-silver-mist">mentions</dt>
          <dd className="text-ink-black">{node.mention_count}</dd>
        </div>
        <div>
          <dt className="text-silver-mist">first seen</dt>
          <dd className="text-ink-black">
            {node.first_seen ? formatTs(node.first_seen) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-silver-mist">last seen</dt>
          <dd className="text-ink-black">
            {node.last_seen ? formatTs(node.last_seen) : "—"}
          </dd>
        </div>
      </dl>

      <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-silver-mist">
        Mentions ({mentions.length})
      </h3>
      <ol className="mt-2 space-y-2">
        {mentions.map((m) => (
          <li
            key={m.id}
            className="rounded-default border border-frost-gray bg-cloud-canvas p-2 text-[11px]"
          >
            <div className="mb-0.5 flex justify-between text-slate-gray">
              <span className="font-mono">{m.source_kind}</span>
              <span className="font-mono">{formatTs(m.ts)}</span>
            </div>
            <div className="text-stone-gray">
              {m.context_snippet || "(no snippet)"}
            </div>
          </li>
        ))}
        {mentions.length === 0 && (
          <li className="text-[11px] text-silver-mist">No recorded mentions.</li>
        )}
      </ol>
    </div>
  );
}

function formatTs(ts: number): string {
  try {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}
