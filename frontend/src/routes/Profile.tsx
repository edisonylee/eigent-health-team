import ReactMarkdown from "react-markdown";
import { useProfileSynthesis, useSynthesizeProfile } from "../lib/queries";
import { useStore } from "../store";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

/** "About me" — the agent's rolling synthesis of the user.
 *
 * Read-only by design. The synthesizer (backend/profile_synthesis.py) runs
 * automatically after every check-in and every completed run; this page is
 * a window into the agent's current working model of you. Manual refresh
 * is available as a fallback.
 */
export default function Profile() {
  const password = useStore((s) => s.password);
  const { data, isLoading } = useProfileSynthesis();
  const refresh = useSynthesizeProfile();

  const notes = data?.notes?.trim() || "";
  const synthesizedAt = data?.synthesized_at;
  const counts = data
    ? { c: data.check_ins, m: data.run_memos, b: data.biomarkers }
    : null;

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-heading font-semibold text-ink-black">
          About you
        </h1>
        <p className="mb-6 text-body text-slate-gray">
          The agent's rolling synthesis of who you are — distilled from your
          check-ins, the plans the Workforce has written for you, and your
          most recent biomarkers. Refreshes automatically after every
          check-in and every completed run.
        </p>

        <Card surface="starless" className="space-y-4">
          {isLoading && (
            <div className="text-body text-slate-gray">Loading…</div>
          )}
          {!isLoading && !notes && (
            <div className="text-body text-slate-gray">
              No synthesis yet. Log a check-in or run a plan, or click
              "Synthesize now" to seed it from existing data.
            </div>
          )}
          {notes && (
            <article className="prose-style text-body leading-relaxed text-ink-black">
              <ReactMarkdown>{notes}</ReactMarkdown>
            </article>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frost-gray pt-3 font-mono text-[11px] text-silver-mist">
            <div>
              {synthesizedAt ? (
                <>
                  Synthesized {relativeTime(synthesizedAt)}
                  {counts && (
                    <>
                      {" "}· from {counts.c} check-in{counts.c === 1 ? "" : "s"},{" "}
                      {counts.m} run memo{counts.m === 1 ? "" : "s"},{" "}
                      {counts.b} biomarker{counts.b === 1 ? "" : "s"}
                    </>
                  )}
                </>
              ) : (
                "Never synthesized."
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => refresh.mutate({ password })}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? "Synthesizing…" : "Synthesize now"}
            </Button>
          </div>
          {refresh.isError && (
            <div className="rounded-default border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
              {String(refresh.error)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diffSec = Math.max(0, Date.now() / 1000 - ts);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
