import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useStore } from "../store";

interface MemoPanelProps {
  onFollowUp?: (note: string) => Promise<void> | void;
}

/** Renders the final health plan.
 *
 * Note: per the design system's "rhythmic dark/light contrast" rule, this
 * panel is intentionally a Frost (#FFFFFF) card inside the otherwise dark
 * canvas — it's the deliverable, and dense reading content lives in
 * light-on-white.
 */
export default function MemoPanel({ onFollowUp }: MemoPanelProps) {
  const memo = useStore((s) => s.memo);
  const phase = useStore((s) => s.phase);

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!onFollowUp || !note.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onFollowUp(note.trim());
      setNote("");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "running") {
    return (
      <div className="rounded-card border border-twilight-ink bg-starless-night p-6 text-body text-slate-gray">
        Agents are working — your health plan will appear here when the Plan
        Writer finishes.
      </div>
    );
  }

  if (!memo) return null;

  return (
    <div className="space-y-3">
      <article className="memo rounded-card bg-frost p-7 shadow-card">
        <ReactMarkdown>{memo}</ReactMarkdown>
      </article>

      {phase === "done" && onFollowUp && (
        <div className="rounded-card border border-twilight-ink bg-starless-night p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-flare">
            Follow-up
          </h3>
          <p className="mt-1.5 text-[12px] text-slate-gray">
            Add new context — e.g.{" "}
            <em>"actually I also have left knee pain on stairs"</em>. Only the
            Safety Reviewer + Plan Writer re-run; Researcher and Assessor's
            work is preserved.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Anything to add to your profile?"
              disabled={submitting}
              className="flex-1 rounded-default bg-frost/5 px-3 py-2 text-body text-frost placeholder:text-slate-gray outline-none transition-[box-shadow] focus:shadow-subtle-1 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!note.trim() || submitting}
              className="rounded-pill bg-electric-blue px-5 py-2 text-body font-medium text-frost transition hover:brightness-110 disabled:opacity-40"
            >
              {submitting ? "Refining…" : "Refine"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
