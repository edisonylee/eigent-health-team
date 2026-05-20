import { useParams } from "react-router-dom";
import AgentTimeline from "../components/AgentTimeline";

export default function Timeline() {
  const { taskId } = useParams();
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-heading font-semibold text-ink-black">
          Run timeline
        </h1>
        <p className="mb-5 font-mono text-[11px] text-silver-mist">task: {taskId}</p>
        <AgentTimeline taskId={taskId} />
      </div>
    </div>
  );
}
