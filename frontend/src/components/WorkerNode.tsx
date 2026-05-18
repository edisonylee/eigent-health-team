import { memo, useEffect, useRef } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ROLE_LABEL, Role, Status } from "../store";

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
}

function WorkerNodeImpl({ data }: NodeProps<WorkerNodeData>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.text]);

  return (
    <div
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-sm transition-colors ${NODE_STYLE[data.status]}`}
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
      <div
        ref={scrollRef}
        className="mt-1.5 h-16 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-stone-500"
      >
        {data.text || (data.status === "pending" ? "waiting…" : "")}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(WorkerNodeImpl);
