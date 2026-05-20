import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import type { RunRow } from "../lib/api";
import { useRuns, useTimeline } from "../lib/queries";

/** Plan — your latest health plan and the runs that produced previous ones.
 *
 *  The primary read-view of the longitudinal product. New runs are created
 *  via /plan/new (which is the live composer + Workforce stream).
 */
export default function Plan() {
  const { data: runs, isLoading } = useRuns(50);

  // Plan view shows comprehensive Workforce runs only. Quick asks live at /ask.
  const planRuns = (runs || []).filter((r) => r.mode !== "ask");
  const completed = planRuns.filter((r) => r.status === "done" && r.memo);
  const latest = completed[0];
  const earlier = completed.slice(1);
  const inFlight = planRuns.find((r) => r.status !== "done" && r.status !== "error");

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-heading font-semibold text-ink-black">Plan</h1>
            <p className="mt-1 text-body text-slate-gray">
              The latest plan the Workforce wrote for you. Past plans below.
            </p>
          </div>
          <Link to="/plan/new">
            <Button size="md">Start a new plan →</Button>
          </Link>
        </header>

        {inFlight && (
          <Card surface="starless" className="mb-5 border border-fire-orange/40 bg-fire-orange/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-fire-orange">
                  In progress
                </div>
                <p className="mt-1 text-body text-ink-black">
                  A run is currently in flight.
                </p>
              </div>
              <Link to="/plan/new">
                <Button size="sm" variant="ghost">
                  View live →
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="text-body text-slate-gray">loading…</div>
        ) : !latest ? (
          <EmptyState />
        ) : (
          <>
            <LatestPlanCard run={latest} />
            {earlier.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-subheading font-medium text-ink-black">
                  Earlier plans
                </h2>
                <ul className="space-y-2">
                  {earlier.map((r) => (
                    <li key={r.task_id}>
                      <HistoryRow run={r} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card surface="starless" className="text-center">
      <p className="text-body text-slate-gray">
        No plans yet. Start your first one — the Workforce will research,
        assess, safety-check, and write a plan against your accumulated memory.
      </p>
      <div className="mt-4">
        <Link to="/plan/new">
          <Button>Start your first plan →</Button>
        </Link>
      </div>
    </Card>
  );
}

function LatestPlanCard({ run }: { run: RunRow }) {
  const startedLabel = run.started_at
    ? new Date(run.started_at * 1000).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <Card surface="starless">
      <div className="flex items-baseline justify-between border-b border-frost-gray pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
            Latest plan
          </div>
          <div className="mt-1 font-mono text-[12px] text-stone-gray">
            {startedLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Badge tone="green">{run.status}</Badge>
          {run.cost_usd > 0 && (
            <span className="font-mono text-slate-gray">
              ${run.cost_usd.toFixed(4)}
            </span>
          )}
          <Link
            to={`/runs/${run.task_id}/timeline`}
            className="rounded-default border border-frost-gray bg-paper-white/5 px-2 py-1 text-stone-gray hover:bg-paper-white/10 hover:text-ink-black"
          >
            timeline →
          </Link>
        </div>
      </div>

      {run.idea && (
        <div className="border-b border-frost-gray py-3 text-[12px] text-slate-gray">
          <span className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
            asked
          </span>{" "}
          <span className="text-ink-black">{run.idea}</span>
        </div>
      )}

      <InformedByFooter taskId={run.task_id} />

      <article className="prose-style mt-4 max-w-none text-body leading-relaxed text-ink-black">
        <ReactMarkdown>{run.memo || ""}</ReactMarkdown>
      </article>
    </Card>
  );
}

/** Reads the run's timeline, finds the `run_context` event the runner emits
 *  at task start, and renders a one-line footer showing exactly how much of
 *  the user's accumulated memory fed this plan. Visible proof the loop closed. */
function InformedByFooter({ taskId }: { taskId: string }) {
  const { data: events } = useTimeline(taskId);
  const ctx = (events || []).find((e) => e.kind === "run_context");
  if (!ctx) return null;
  const p = ctx.payload as Record<string, number | undefined>;
  const bits = [
    [p.context_check_ins, "check-in"],
    [p.context_events, "logged event"],
    [p.context_biomarkers, "biomarker"],
    [p.context_entities, "memory entity"],
    [p.context_prior_plans, "prior plan"],
  ] as const;
  const parts = bits
    .filter(([n]) => typeof n === "number" && (n as number) > 0)
    .map(([n, label]) => `${n} ${label}${(n as number) === 1 ? "" : "s"}`);
  if (parts.length === 0) {
    return (
      <div className="border-b border-frost-gray py-2 font-mono text-[11px] text-silver-mist">
        Informed by: nothing yet — first run.
      </div>
    );
  }
  return (
    <div className="border-b border-frost-gray py-2 font-mono text-[11px] text-silver-mist">
      <span className="uppercase tracking-[0.2em]">Informed by</span> ·{" "}
      <span className="text-stone-gray">{parts.join(" · ")}</span>
    </div>
  );
}

function HistoryRow({ run }: { run: RunRow }) {
  const startedLabel = run.started_at
    ? new Date(run.started_at * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <Link
      to={`/runs/${run.task_id}/timeline`}
      className="flex items-baseline justify-between rounded-default border border-frost-gray bg-paper-white px-3 py-2 text-[12px] hover:bg-cloud-canvas/40"
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-stone-gray">{startedLabel}</span>
        <span className="text-slate-gray">
          {(run.idea || "").slice(0, 80)}
          {run.idea && run.idea.length > 80 ? "…" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {run.cost_usd > 0 && (
          <span className="font-mono text-silver-mist">
            ${run.cost_usd.toFixed(4)}
          </span>
        )}
        <Badge tone={run.status === "done" ? "green" : "neutral"}>{run.status}</Badge>
      </div>
    </Link>
  );
}
