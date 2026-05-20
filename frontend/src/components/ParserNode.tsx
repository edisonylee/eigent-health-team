import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";

type ParserStatus = "idle" | "running" | "done";

const NODE_STYLE: Record<ParserStatus, string> = {
  idle: "border-dashed border-stone-300 bg-stone-50 text-stone-500",
  running: "border-amber-400 bg-amber-50 text-stone-800",
  done: "border-violet-400 bg-violet-50 text-stone-800",
};

const BADGE: Record<ParserStatus, string> = {
  idle: "bg-stone-200 text-stone-600",
  running: "bg-amber-200 text-amber-800",
  done: "bg-violet-200 text-violet-900",
};

interface ParserNodeData {
  status: ParserStatus;
  biomarkerCount: number;
}

/** Standalone Lab Parser node — runs once per upload, upstream of the
 * Workforce coordinator. Idle while no labs are attached. */
function ParserNodeImpl({ data }: NodeProps<ParserNodeData>) {
  const status = data.status;
  return (
    <div
      className={`w-48 rounded-lg border-2 px-3 py-2 shadow-sm transition-colors ${NODE_STYLE[status]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Lab Parser</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${BADGE[status]}`}
        >
          {status === "running" ? "● parsing" : status}
        </span>
      </div>

      <div className="mt-1 font-mono text-[10px]">
        {status === "done"
          ? `${data.biomarkerCount} biomarker${data.biomarkerCount === 1 ? "" : "s"} extracted`
          : status === "running"
            ? "reading the document…"
            : "drop a PDF or paste lab text to activate"}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ParserNodeImpl);
