import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { Badge } from "./ui/Badge";

type ParserStatus = "idle" | "running" | "done";

const SHELL: Record<ParserStatus, string> = {
  idle: "border-dashed border-twilight-ink bg-starless-night text-slate-gray",
  running: "border-electric-blue/70 bg-starless-night text-frost shadow-glow animate-pulse-glow",
  done: "border-fuchsia-flare/60 bg-starless-night text-frost shadow-glow-fuchsia",
};

interface ParserNodeData {
  status: ParserStatus;
  biomarkerCount: number;
}

function ParserNodeImpl({ data }: NodeProps<ParserNodeData>) {
  const status = data.status;
  return (
    <div
      className={`w-52 rounded-default border px-3 py-2.5 transition-all ${SHELL[status]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">Lab Parser</span>
        <Badge
          tone={
            status === "running" ? "blue" : status === "done" ? "fuchsia" : "neutral"
          }
        >
          {status === "running" ? "● parsing" : status}
        </Badge>
      </div>

      <div className="mt-1.5 font-mono text-[10px]">
        {status === "done"
          ? `${data.biomarkerCount} biomarker${data.biomarkerCount === 1 ? "" : "s"} extracted`
          : status === "running"
            ? "reading the document…"
            : "drop a PDF or paste lab text to activate"}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-twilight-ink" />
    </div>
  );
}

export default memo(ParserNodeImpl);
