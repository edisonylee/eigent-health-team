import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

import type { MemoryGraphNode } from "../lib/api";
import {
  useEntityMentions,
  useMemoryGraph,
  useReindexMemoryGraph,
} from "../lib/queries";
import { useStore } from "../store";

// Per-type styling — color drives both the node fill and the filter chip.
const TYPE_STYLE: Record<string, { color: string; label: string }> = {
  nutrient:    { color: "#8b5cf6", label: "Nutrient" },     // violet
  condition:   { color: "#ef4444", label: "Condition" },    // red
  provider:    { color: "#0ea5e9", label: "Provider" },     // sky
  medication:  { color: "#f97316", label: "Medication" },   // orange
  food:        { color: "#16a34a", label: "Food" },         // green
  place:       { color: "#a3a3a3", label: "Place" },        // stone
  person:      { color: "#ec4899", label: "Person" },       // pink
  activity:    { color: "#0d9488", label: "Activity" },     // teal
  biomarker:   { color: "#7c3aed", label: "Biomarker" },    // deep violet
  exercise:    { color: "#22c55e", label: "Exercise" },     // light green
  other:       { color: "#78716c", label: "Other" },        // warm gray
};

const DEFAULT_STYLE = { color: "#78716c", label: "Other" };

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

  // Filter nodes + links by active type filter.
  const filtered = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    if (typeFilter.size === 0) return data;
    const keep = new Set(
      data.nodes
        .filter((n) => typeFilter.has(n.type))
        .map((n) => n.id),
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

  // Custom node renderer — color by type, size by mention_count, label always
  // visible at higher zoom.
  const drawNode = useCallback(
    (n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const radius = Math.max(4, 4 + Math.log2(1 + (n.mention_count || 1)) * 2);
      const { color } = styleFor(n.type);
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      // Canonical-linked nodes get a darker ring.
      if (n.canonical_id) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#1c1917";
        ctx.stroke();
      }
      if (globalScale >= 1.2) {
        ctx.font = `${10 / globalScale}px ui-sans-serif`;
        ctx.fillStyle = "#1c1917";
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
            <h1 className="font-serif text-2xl text-stone-900">Memory Graph</h1>
            <p className="text-sm text-stone-500">
              Entities the system has extracted from your plans, check-ins,
              labs, and profile. Canonical entities (ringed) link back to
              the curated health graph.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => reindexNow(false)}
              disabled={reindex.isPending}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs hover:bg-stone-50 disabled:opacity-40"
            >
              {reindex.isPending ? "Reindexing…" : "Reindex"}
            </button>
            <button
              type="button"
              onClick={() => reindexNow(true)}
              disabled={reindex.isPending}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"
              title="Wipe both tables and re-extract from scratch"
            >
              Reset + reindex
            </button>
          </div>
        </header>

        {types.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-stone-500">Filter:</span>
            {types.map((t) => {
              const { color, label } = styleFor(t);
              const active = typeFilter.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
                    active
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
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
                className="text-stone-500 underline-offset-2 hover:underline"
              >
                clear
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-[640px] w-full overflow-hidden rounded-xl border border-stone-200 bg-white">
            {isLoading && (
              <div className="flex h-full items-center justify-center text-sm text-stone-500">
                Loading…
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center text-sm text-red-700">
                {String(error)}
              </div>
            )}
            {!isLoading && data && data.nodes.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-stone-500">
                <p>No entities yet. Run a plan or hit Reindex to seed the graph.</p>
                <button
                  type="button"
                  onClick={() => reindexNow(false)}
                  disabled={reindex.isPending}
                  className="rounded-md bg-stone-900 px-4 py-1.5 text-xs text-white hover:bg-stone-700 disabled:opacity-40"
                >
                  Reindex now
                </button>
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
                linkColor={() => "#d6d3d1"}
                linkWidth={(l: any) => Math.max(0.5, Math.log2(1 + l.value))}
                onNodeClick={onNodeClick}
                cooldownTicks={120}
                d3AlphaDecay={0.025}
                d3VelocityDecay={0.45}
                backgroundColor="#fafaf9"
              />
            )}
          </div>

          <aside className="rounded-xl border border-stone-200 bg-white p-4">
            {detail && detail.entity ? (
              <EntityDetailPanel
                node={detail.entity}
                mentions={detail.mentions}
              />
            ) : (
              <div className="space-y-3 text-sm text-stone-500">
                <p>Click any node to see its mentions.</p>
                <p>
                  Node size reflects mention count. A dark ring means the
                  entity matched a canonical node in the health graph.
                </p>
                {data && (
                  <p className="font-mono text-[11px] text-stone-400">
                    {data.nodes.length} nodes · {data.links.length} edges
                  </p>
                )}
              </div>
            )}
          </aside>
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
        <span className="text-[10px] uppercase tracking-wider text-stone-500">
          {label}
        </span>
      </div>
      <h2 className="font-serif text-lg text-stone-900">{node.name}</h2>
      {node.canonical_id && (
        <div className="mt-1 inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">
          canonical: {node.canonical_id}
        </div>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-stone-600">
        <div>
          <dt className="text-stone-400">mentions</dt>
          <dd>{node.mention_count}</dd>
        </div>
        <div>
          <dt className="text-stone-400">first seen</dt>
          <dd>{node.first_seen ? formatTs(node.first_seen) : "—"}</dd>
        </div>
        <div>
          <dt className="text-stone-400">last seen</dt>
          <dd>{node.last_seen ? formatTs(node.last_seen) : "—"}</dd>
        </div>
      </dl>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Mentions ({mentions.length})
      </h3>
      <ol className="mt-1.5 space-y-2">
        {mentions.map((m) => (
          <li
            key={m.id}
            className="rounded-md border border-stone-200 bg-stone-50 p-2 text-[11px]"
          >
            <div className="mb-0.5 flex justify-between text-stone-500">
              <span className="font-mono">{m.source_kind}</span>
              <span className="font-mono">{formatTs(m.ts)}</span>
            </div>
            <div className="text-stone-800">
              {m.context_snippet || "(no snippet)"}
            </div>
          </li>
        ))}
        {mentions.length === 0 && (
          <li className="text-[11px] text-stone-500">No recorded mentions.</li>
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
