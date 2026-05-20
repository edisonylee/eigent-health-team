import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Textarea } from "../components/ui/Input";
import { useAsk, useProfileSynthesis, useRuns } from "../lib/queries";
import { streamRun } from "../lib/sse";
import { useStore } from "../store";

/** Ask — single-agent Q&A grounded in the profile synthesis.
 *
 *  Distinct from /plan (which runs the full Workforce). This one is:
 *    - One ChatAgent with ASK_PROMPT, no tools, no web search.
 *    - Answers in 1–3 paragraphs of plain prose, ~5–10s, well under a cent.
 *    - Persisted as a `run` row with mode='ask' so it shows up in the
 *      memory sources alongside plans.
 */
export default function Ask() {
  const password = useStore((s) => s.password);
  const ask = useAsk();
  const { data: synthesis } = useProfileSynthesis();
  const { data: runs, refetch } = useRuns(50);

  const [question, setQuestion] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeAnswer, setActiveAnswer] = useState<string>("");
  const [activePhase, setActivePhase] = useState<"running" | "done" | "error" | null>(null);
  const [activeError, setActiveError] = useState<string>("");
  const esRef = useRef<EventSource | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const hasSynthesis = !!synthesis?.notes?.trim();
  // Exclude the active run from the history list — it's rendered separately
  // as the streaming QACard. Without this filter the row appears twice from
  // the moment `start_ask` persists it (which is before the stream finishes),
  // and stays doubled after `task_complete` triggers `refetch()`.
  const askRuns = (runs || []).filter(
    (r) => r.mode === "ask" && r.task_id !== activeTaskId,
  );

  // Newest at bottom — natural chat order.
  const orderedRuns = [...askRuns].reverse();

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [orderedRuns.length, activeAnswer]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const submit = async () => {
    const q = question.trim();
    if (!q || ask.isPending || activePhase === "running") return;
    setActiveError("");
    setActiveAnswer("");
    setActivePhase("running");
    try {
      const { task_id } = await ask.mutateAsync({ question: q, password });
      setActiveTaskId(task_id);
      setQuestion("");
      esRef.current?.close();
      esRef.current = streamRun(task_id, (ev) => {
        if (ev.type === "worker_chunk" && ev.role === "summarizer" && ev.text) {
          setActiveAnswer((prev) => prev + ev.text);
        } else if (ev.type === "task_complete") {
          setActivePhase("done");
          esRef.current?.close();
          refetch();
        } else if (ev.type === "error") {
          setActivePhase("error");
          setActiveError(ev.text || "Unknown error.");
          esRef.current?.close();
        }
      });
    } catch (e) {
      setActiveError(String(e));
      setActivePhase("error");
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="mb-4">
          <h1 className="text-heading font-semibold text-ink-black">Ask</h1>
          <p className="mt-1 text-body text-slate-gray">
            Quick questions grounded in what's in your{" "}
            <Link to="/memory" className="text-fire-orange underline-offset-4 hover:underline">
              memory
            </Link>
            . For multi-step plans the agents need to research and assemble,
            use{" "}
            <Link to="/plan" className="text-fire-orange underline-offset-4 hover:underline">
              Plan
            </Link>{" "}
            instead.
          </p>
        </header>

        <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-gray">
          <span
            aria-hidden
            className={
              "inline-block h-1.5 w-1.5 rounded-full " +
              (hasSynthesis ? "bg-status-success" : "bg-silver-mist")
            }
          />
          {hasSynthesis ? (
            <span>
              Profile loaded — the agent already knows you. Ask anything.
            </span>
          ) : (
            <span>
              No profile synthesis yet. Log a{" "}
              <Link to="/today" className="text-stone-gray underline-offset-2 hover:text-ink-black hover:underline">
                check-in
              </Link>{" "}
              and the agent will build one.
            </span>
          )}
        </div>

        <div className="mb-5 space-y-4">
          {orderedRuns.length === 0 && activePhase === null && (
            <Card surface="starless" className="text-body text-slate-gray">
              Ask anything. The agent will answer from your profile —
              providers, supplements, biomarker trends, what's worked.
            </Card>
          )}
          {orderedRuns.map((r) => (
            <QACard key={r.task_id} question={r.idea || ""} answer={r.memo || ""} costUsd={r.cost_usd} />
          ))}
          {activePhase && (
            <QACard
              question={runs?.find((r) => r.task_id === activeTaskId)?.idea || ""}
              answer={activeAnswer || (activePhase === "running" ? "…" : "")}
              streaming={activePhase === "running"}
              error={activePhase === "error" ? activeError : undefined}
            />
          )}
          <div ref={feedEndRef} />
        </div>

        <div className="sticky bottom-4 mt-auto rounded-card border border-frost-gray bg-paper-white p-3 shadow-card">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask anything. e.g. 'Should I take magnesium with food?' · 'Is my last HbA1c worrying?' · 'Why did Dr. Patel cut the ibuprofen?'"
            disabled={activePhase === "running"}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-silver-mist">
              Enter to send · Shift+Enter for newline · ~$0.003 per ask
            </span>
            <Button
              size="sm"
              type="button"
              onClick={submit}
              disabled={!question.trim() || activePhase === "running"}
            >
              {activePhase === "running" ? "Asking…" : "Ask"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QACard({
  question,
  answer,
  costUsd,
  streaming,
  error,
}: {
  question: string;
  answer: string;
  costUsd?: number;
  streaming?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      {question && (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-card bg-ink-black px-4 py-2 text-body text-paper-white">
            {question}
          </div>
        </div>
      )}
      <Card surface="paper" className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Badge tone={streaming ? "gold" : "green"}>
            {streaming ? "answering…" : "answer"}
          </Badge>
          {costUsd != null && costUsd > 0 && !streaming && (
            <span className="font-mono text-[10px] text-silver-mist">
              ${costUsd.toFixed(4)}
            </span>
          )}
        </div>
        {error ? (
          <div className="rounded-default border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
            {error}
          </div>
        ) : (
          <article className="prose-style max-w-none text-body leading-relaxed text-ink-black">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </article>
        )}
      </Card>
    </div>
  );
}
