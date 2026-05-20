import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { selectTotalCost, useStore } from "../store";

/** Parse a markdown plan's top-level (#) sections into a name→content map. */
function parseSections(memo: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const re = /^#\s+(.+?)\s*$/gm;
  const matches: { idx: number; name: string; headerLen: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(memo)) !== null) {
    matches.push({
      idx: m.index,
      name: m[1].trim().toLowerCase(),
      headerLen: m[0].length,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx + matches[i].headerLen;
    const end =
      i + 1 < matches.length ? matches[i + 1].idx : memo.length;
    sections[matches[i].name] = memo.slice(start, end).trim();
  }
  return sections;
}

/** Pre-completion approval gate. Plan is hidden until Approve resolves the backend Future. */
export default function ApprovalModal() {
  const phase = useStore((s) => s.phase);
  const pendingMemo = useStore((s) => s.pendingMemo);
  const taskId = useStore((s) => s.taskId);
  const password = useStore((s) => s.password);
  const applyEvent = useStore((s) => s.applyEvent);
  const totalCost = useStore(selectTotalCost);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (phase !== "awaiting_approval" || !pendingMemo) return null;

  const sections = parseSections(pendingMemo);
  const profile = sections["your profile"] || "";
  const safetyNotes = sections["safety notes"] || "";
  const oneThing = sections["if you only do one thing this week"] || "";
  const focusAreas = sections["focus areas"] || "";

  const respond = async (approved: boolean) => {
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(`/api/run/${taskId}/human_input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.detail || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      // SSE will fire task_complete or error; the store will flip phase.
    } catch (err) {
      setActionError(String(err));
      setBusy(false);
      // Force the run into an error state locally so the user isn't stuck.
      applyEvent({ type: "error", text: String(err) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-6 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="border-b border-stone-200 bg-white px-6 py-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-700">
            Human-in-the-loop · approval required
          </div>
          <h2 className="mt-1 font-serif text-xl text-stone-900">
            Review the plan before it's released
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            The four agents are done. Skim the safety notes and the headline
            action below, then approve to view the full plan — or reject and
            discard the run.
          </p>
        </div>

        <div className="max-h-[58vh] space-y-5 overflow-y-auto px-6 py-5">
          {profile && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Your profile (as the agents heard it)
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">
                {profile}
              </p>
            </section>
          )}

          {safetyNotes && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Safety notes
              </h3>
              <div className="memo mt-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ReactMarkdown>{safetyNotes}</ReactMarkdown>
              </div>
            </section>
          )}

          {focusAreas && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Focus areas
              </h3>
              <div className="memo mt-1 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700">
                <ReactMarkdown>{focusAreas}</ReactMarkdown>
              </div>
            </section>
          )}

          {oneThing && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                If you only do one thing this week
              </h3>
              <div className="memo mt-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <ReactMarkdown>{oneThing}</ReactMarkdown>
              </div>
            </section>
          )}

          <section className="flex items-center justify-between border-t border-stone-200 pt-3 font-mono text-[11px] text-stone-500">
            <span>cost so far</span>
            <span className="text-base text-stone-800">
              ${totalCost.toFixed(4)}
            </span>
          </section>
        </div>

        {actionError && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-white px-6 py-3">
          <button
            type="button"
            onClick={() => respond(false)}
            disabled={busy}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-40"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => respond(true)}
            disabled={busy}
            className="rounded-md bg-emerald-700 px-5 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {busy ? "Submitting…" : "Approve & view plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
