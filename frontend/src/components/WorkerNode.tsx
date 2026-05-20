import { memo, useEffect, useRef } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ROLE_LABEL, Role, Status, useStore } from "../store";
import { Badge } from "./ui/Badge";

const SHELL: Record<Status, string> = {
  pending: "border-cloud-canvas bg-paper-white",
  running:
    "border-fire-orange bg-paper-white shadow-glow animate-pulse-glow",
  done: "border-status-done/40 bg-paper-white",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "idle",
  running: "● running",
  done: "done",
};

interface WorkerNodeData {
  role: Role;
  status: Status;
  text: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost: number;
  kbCount: number;
  webCount: number;
  graphCount: number;
}

function WorkerNodeImpl({ data }: NodeProps<WorkerNodeData>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setExpanded = useStore((s) => s.setExpanded);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.text]);

  const tokens = data.promptTokens + data.completionTokens;
  const hasUsage = tokens > 0;
  const hasReasoning = data.text.toLowerCase().includes("## reasoning");
  const cachePct =
    data.promptTokens > 0
      ? Math.round((data.cachedTokens / data.promptTokens) * 100)
      : 0;
  const hasCache = data.cachedTokens > 0;

  return (
    <div
      onClick={() => setExpanded(data.role)}
      className={`w-56 cursor-pointer rounded-default border px-3 py-2.5 transition-all hover:shadow-subtle ${SHELL[data.status]}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-frost-gray" />
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-black">
          {ROLE_LABEL[data.role]}
        </span>
        <Badge
          tone={
            data.status === "running"
              ? "blue"
              : data.status === "done"
                ? "green"
                : "neutral"
          }
        >
          {STATUS_LABEL[data.status]}
        </Badge>
      </div>

      {(data.kbCount > 0 ||
        data.webCount > 0 ||
        data.graphCount > 0 ||
        hasReasoning ||
        hasCache) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {data.graphCount > 0 && (
            <Badge tone="teal">graph · {data.graphCount}</Badge>
          )}
          {data.kbCount > 0 && (
            <Badge tone="purple">KB · {data.kbCount}</Badge>
          )}
          {data.webCount > 0 && <Badge tone="sky">web · {data.webCount}</Badge>}
          {hasReasoning && <Badge tone="fuchsia">reasoning</Badge>}
          {hasCache && (
            <Badge
              tone="green"
              title={`${data.cachedTokens.toLocaleString()} of ${data.promptTokens.toLocaleString()} input tokens served from cache (50% off)`}
            >
              {cachePct}% cached
            </Badge>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="mt-2 h-14 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-stone-gray/70"
      >
        {data.text || (data.status === "pending" ? "waiting…" : "")}
      </div>

      <div className="mt-1.5 flex items-center justify-between border-t border-frost-gray pt-1.5 font-mono text-[10px] text-slate-gray">
        <span>{hasUsage ? `${tokens.toLocaleString()} tok` : "—"}</span>
        <span className="text-ink-black">
          {hasUsage ? `$${data.cost.toFixed(4)}` : ""}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-frost-gray" />
    </div>
  );
}

export default memo(WorkerNodeImpl);
