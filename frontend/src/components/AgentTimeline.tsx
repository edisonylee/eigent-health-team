import { AnimatePresence, motion } from "framer-motion";
import { useTimeline } from "../lib/queries";
import { ROLE_LABEL, Role, TimelineRow } from "../store";
import { Badge } from "./ui/Badge";

interface Props {
  taskId?: string;
  events?: TimelineRow[];
}

const ROLE_TONE: Record<string, React.ComponentProps<typeof Badge>["tone"]> = {
  researcher: "sky",
  analyst: "purple",
  critic: "gold",
  summarizer: "green",
};

export default function AgentTimeline({ taskId, events }: Props) {
  const liveMode = events !== undefined;
  const dbQuery = useTimeline(liveMode ? undefined : taskId);

  if (liveMode) {
    if (!events || events.length === 0) {
      return (
        <div className="text-[12px] text-pewter">
          Waiting for the first event…
        </div>
      );
    }
    return <Render rows={events} />;
  }

  if (!taskId)
    return <div className="text-[12px] text-pewter">No task selected.</div>;
  if (dbQuery.isLoading)
    return <div className="text-body text-slate-gray">loading timeline…</div>;
  if (dbQuery.error)
    return (
      <div className="rounded-default border border-crimson-red/30 bg-crimson-red/10 px-3 py-2 text-[12px] text-crimson-red">
        {String(dbQuery.error)}
      </div>
    );
  const rows = dbQuery.data || [];
  if (rows.length === 0)
    return (
      <div className="text-[12px] text-pewter">No events recorded yet.</div>
    );
  return <Render rows={rows} />;
}

function Render({ rows }: { rows: TimelineRow[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-twilight-ink bg-starless-night">
      <AnimatePresence initial>
        {rows.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.6), duration: 0.18 }}
            className="border-b border-twilight-ink px-4 py-3 last:border-b-0"
          >
            <Row event={ev} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Row({
  event,
}: {
  event: {
    ts: number;
    kind: string;
    role: string | null;
    payload: Record<string, any>;
  };
}) {
  const time = new Date(event.ts * 1000).toLocaleTimeString();
  const meta = (
    <div className="flex items-center gap-2 text-[11px] text-slate-gray">
      <span className="font-mono">{time}</span>
      {event.role && (
        <Badge tone={ROLE_TONE[event.role] ?? "neutral"}>
          {ROLE_LABEL[event.role as Role] || event.role}
        </Badge>
      )}
      <span className="font-mono uppercase tracking-wider text-pewter">
        {event.kind}
      </span>
    </div>
  );

  if (event.kind === "tool_call") {
    return (
      <div>
        {meta}
        <div className="mt-1 text-body text-frost">
          <span className="font-mono">{event.payload.tool_name}</span>
          {event.payload.tool_query && (
            <span className="ml-2 text-slate-gray">
              ({event.payload.tool_query})
            </span>
          )}
        </div>
        {(event.payload.retrieved_sources?.length ||
          event.payload.retrieved_entities?.length) && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-slate-gray hover:text-frost">
              retrieved{" "}
              {(event.payload.retrieved_sources?.length || 0) +
                (event.payload.retrieved_entities?.length || 0)}{" "}
              item(s)
            </summary>
            <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-default bg-midnight-eclipse p-2 font-mono text-[10px] text-ghostly-gray">
              {JSON.stringify(
                event.payload.retrieved_sources ||
                  event.payload.retrieved_entities,
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>
    );
  }

  if (event.kind === "human_input_required") {
    return (
      <div>
        {meta}
        <div className="mt-1 rounded-default border border-goldenrod/30 bg-goldenrod/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-goldenrod">
            Agent asked
          </div>
          <div className="mt-0.5 text-body text-frost">
            {event.payload.question}
          </div>
          {event.payload.choices?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {event.payload.choices.map((c: string, i: number) => (
                <span
                  key={i}
                  className="rounded bg-frost/10 px-2 py-0.5 text-[11px] text-ghostly-gray"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (event.kind === "human_input_answered") {
    return (
      <div>
        {meta}
        <div className="mt-1 rounded-default border border-vivid-green/30 bg-vivid-green/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-vivid-green">
            You answered
          </div>
          <div className="mt-0.5 text-body text-frost">
            {event.payload.answer}
          </div>
        </div>
      </div>
    );
  }

  if (event.kind === "worker_usage") {
    return (
      <div>
        {meta}
        <div className="mt-1 font-mono text-[12px] text-slate-gray">
          prompt {event.payload.prompt_tokens} · completion{" "}
          {event.payload.completion_tokens} · ${" "}
          <span className="text-frost">
            {(event.payload.cost ?? 0).toFixed(4)}
          </span>
        </div>
      </div>
    );
  }

  if (event.kind === "worker_chunk") {
    return null;
  }

  if (event.kind === "error") {
    return (
      <div>
        {meta}
        <div className="mt-1 rounded-default border border-crimson-red/30 bg-crimson-red/10 px-3 py-2 text-body text-crimson-red">
          {event.payload.text}
        </div>
      </div>
    );
  }

  return (
    <div>
      {meta}
      {event.payload.text && (
        <div className="mt-1 text-body text-ghostly-gray">
          {event.payload.text}
        </div>
      )}
    </div>
  );
}
