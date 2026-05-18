import ReactMarkdown from "react-markdown";
import { useStore } from "../store";

/** Renders the final market memo (or a placeholder while running). */
export default function MemoPanel() {
  const memo = useStore((s) => s.memo);
  const phase = useStore((s) => s.phase);

  if (phase === "running") {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Agents are working — the memo will appear here when the Summarizer finishes.
      </div>
    );
  }

  if (!memo) return null;

  return (
    <article className="memo rounded-xl border border-stone-200 bg-white p-6">
      <ReactMarkdown>{memo}</ReactMarkdown>
    </article>
  );
}
