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
  useReindexMemoryGraph,
} from "../lib/queries";
import { useStore } from "../store";

// Per-type styling — colors drawn from the design system accents so the
// graph integrates with the dark theme.
const TYPE_STYLE: Record<string, { color: string; label: string }> = {
  nutrient:   { color: "#B855E7", label: "Nutrient" },     // magenta burst
  condition:  { color: "#FF5252", label: "Condition" },    // crimson red
  provider:   { color: "#60A5FA", label: "Provider" },     // sky blue
  medication: { color: "#FFB764", label: "Medication" },   // goldenrod
  food:       { color: "#16C253", label: "Food" },         // vivid green
  place:      { color: "#999999", label: "Place" },        // pewter
  person:     { color: "#DD55E7", label: "Person" },       // fuchsia flare
  activity:   { color: "#1CECBB", label: "Activity" },     // teal glow
  biomarker:  { color: "#0088FF", label: "Biomarker" },    // electric blue
  exercise:   { color: "#FFDD00", label: "Exercise" },     // sunshine yellow
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
            <h1 className="text-heading font-semibold text-frost">
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
                      ? "border-frost bg-frost text-midnight-eclipse"
                      : "border-twilight-ink bg-frost/5 text-ghostly-gray hover:bg-frost/10",
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
                className="text-slate-gray underline-offset-2 hover:underline hover:text-frost"
              >
                clear
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-[640px] w-full overflow-hidden rounded-card border border-twilight-ink bg-starless-night">
            {isLoading && (
              <div className="flex h-full items-center justify-center text-body text-slate-gray">
                Loading…
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center text-body text-crimson-red">
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
                  <p className="font-mono text-[11px] text-pewter">
                    {data.nodes.length} nodes · {data.links.length} edges
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
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
        <span className="text-[10px] uppercase tracking-[0.2em] text-pewter">
          {label}
        </span>
      </div>
      <h2 className="text-subheading font-semibold text-frost">{node.name}</h2>
      {node.canonical_id && (
        <div className="mt-1.5">
          <Badge tone="teal">canonical: {node.canonical_id}</Badge>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-gray">
        <div>
          <dt className="text-pewter">mentions</dt>
          <dd className="text-frost">{node.mention_count}</dd>
        </div>
        <div>
          <dt className="text-pewter">first seen</dt>
          <dd className="text-frost">
            {node.first_seen ? formatTs(node.first_seen) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-pewter">last seen</dt>
          <dd className="text-frost">
            {node.last_seen ? formatTs(node.last_seen) : "—"}
          </dd>
        </div>
      </dl>

      <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-pewter">
        Mentions ({mentions.length})
      </h3>
      <ol className="mt-2 space-y-2">
        {mentions.map((m) => (
          <li
            key={m.id}
            className="rounded-default border border-twilight-ink bg-midnight-eclipse p-2 text-[11px]"
          >
            <div className="mb-0.5 flex justify-between text-slate-gray">
              <span className="font-mono">{m.source_kind}</span>
              <span className="font-mono">{formatTs(m.ts)}</span>
            </div>
            <div className="text-ghostly-gray">
              {m.context_snippet || "(no snippet)"}
            </div>
          </li>
        ))}
        {mentions.length === 0 && (
          <li className="text-[11px] text-pewter">No recorded mentions.</li>
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
