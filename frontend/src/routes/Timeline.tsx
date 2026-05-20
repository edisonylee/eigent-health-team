import { useParams } from "react-router-dom";
import AgentTimeline from "../components/AgentTimeline";

export default function Timeline() {
  const { taskId } = useParams();
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-serif text-2xl text-stone-900">
          Run timeline
        </h1>
        <p className="mb-5 font-mono text-xs text-stone-500">
          task: {taskId}
        </p>
        <AgentTimeline taskId={taskId} />
      </div>
    </div>
  );
}
