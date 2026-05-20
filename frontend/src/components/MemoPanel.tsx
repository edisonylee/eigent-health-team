import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useStore } from "../store";

interface MemoPanelProps {
  /** Called when the user submits a follow-up note. */
  onFollowUp?: (note: string) => Promise<void> | void;
}

/** Renders the final health plan, plus a follow-up input when complete. */
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
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Agents are working — your health plan will appear here when the Plan
        Writer finishes.
      </div>
    );
  }

  if (!memo) return null;

  return (
    <div className="space-y-3">
      <article className="memo rounded-xl border border-stone-200 bg-white p-6">
        <ReactMarkdown>{memo}</ReactMarkdown>
      </article>

      {phase === "done" && onFollowUp && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Follow-up
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            Add new context — e.g.{" "}
            <em>"actually I also have left knee pain on stairs"</em>. Only the
            Safety Reviewer + Plan Writer re-run; Researcher and Assessor's
            work is preserved.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Anything to add to your profile?"
              disabled={submitting}
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 disabled:bg-stone-100"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!note.trim() || submitting}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {submitting ? "Refining…" : "Refine"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
