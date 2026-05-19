import { memo, useEffect, useRef } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ROLE_LABEL, Role, Status, useStore } from "../store";

const NODE_STYLE: Record<Status, string> = {
  pending: "border-stone-300 bg-stone-50",
  running: "border-amber-400 bg-amber-50",
  done: "border-emerald-400 bg-emerald-50",
};

const BADGE_STYLE: Record<Status, string> = {
  pending: "bg-stone-200 text-stone-600",
  running: "bg-amber-200 text-amber-800",
  done: "bg-emerald-200 text-emerald-800",
};

interface WorkerNodeData {
  role: Role;
  status: Status;
  text: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  toolCallCount: number;
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

  return (
    <div
      onClick={() => setExpanded(data.role)}
      className={`w-52 cursor-pointer rounded-lg border-2 px-3 py-2 shadow-sm transition-colors hover:shadow-md ${NODE_STYLE[data.status]}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-800">
          {ROLE_LABEL[data.role]}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${BADGE_STYLE[data.status]}`}
        >
          {data.status === "running" ? "● running" : data.status}
        </span>
      </div>

      {data.toolCallCount > 0 && (
        <div className="mt-1 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">
          🔍 {data.toolCallCount}{" "}
          {data.toolCallCount === 1 ? "search" : "searches"}
        </div>
      )}

      <div
        ref={scrollRef}
        className="mt-1.5 h-14 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-stone-500"
      >
        {data.text || (data.status === "pending" ? "waiting…" : "")}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-stone-200 pt-1 font-mono text-[10px] text-stone-500">
        <span>{hasUsage ? `${tokens.toLocaleString()} tok` : "—"}</span>
        <span className="text-stone-700">
          {hasUsage ? `$${data.cost.toFixed(4)}` : ""}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(WorkerNodeImpl);
