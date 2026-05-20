import { useEffect, useState } from "react";
import { ROLE_LABEL, useStore } from "../store";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Input";

interface AgentQuestionModalProps {
  onAnswer: (request_id: string, answer: string) => Promise<void> | void;
}

/**
 * Renders the head of the question queue — the most recent agent that asked
 * for input gets the modal. Submitting (or "use your best judgment") sends
 * an answer to the backend, which resolves the agent's blocking tool call.
 */
export default function AgentQuestionModal({ onAnswer }: AgentQuestionModalProps) {
  const head = useStore((s) => s.questionQueue[0]);
  const dismiss = useStore((s) => s.dismissQuestion);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText("");
    setBusy(false);
  }, [head?.request_id]);

  if (!head) return null;

  const submit = async (answer: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await onAnswer(head.request_id, answer);
    } finally {
      dismiss(head.request_id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-cloud-canvas/70 p-6 backdrop-blur-md md:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-card bg-paper-white shadow-xl shadow-subtle-1">
        <div className="border-b border-frost-gray px-6 py-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-fire-orange">
            Human-in-the-loop · {ROLE_LABEL[head.role]} needs input
          </div>
          <h2 className="mt-2 text-subheading font-medium text-ink-black">
            {head.question}
          </h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          {head.choices.length > 0 ? (
            <div className="flex flex-col gap-2">
              {head.choices.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => submit(c)}
                  disabled={busy}
                  className="rounded-default border border-frost-gray bg-paper-white/5 px-3 py-2 text-left text-body text-ink-black transition-colors hover:bg-paper-white/10 hover:shadow-subtle-1 disabled:opacity-40"
                >
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(text);
                }}
                placeholder="Your answer… (⌘/Ctrl+Enter to submit)"
                rows={3}
                disabled={busy}
              />
              <Button
                type="button"
                onClick={() => submit(text)}
                disabled={!text.trim() || busy}
                className="mt-2 w-full"
              >
                {busy ? "Submitting…" : "Submit answer"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-frost-gray bg-cloud-canvas/40 px-6 py-3 text-[12px]">
          <span className="text-slate-gray">Not sure? Let the agent decide:</span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => submit("use your best judgment")}
            disabled={busy}
          >
            Use your best judgment
          </Button>
        </div>
      </div>
    </div>
  );
}
