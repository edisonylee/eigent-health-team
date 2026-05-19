import { useMemo } from "react";
import ReactFlow, { Background, Edge, Node } from "reactflow";
import { ROLE_ORDER, useStore } from "../store";
import WorkerNode from "./WorkerNode";

const nodeTypes = { worker: WorkerNode };

/** Live node graph of the Workforce: coordinator → 4 workers → memo. */
export default function TaskGraph() {
  const workers = useStore((s) => s.workers);
  const phase = useStore((s) => s.phase);

  const nodes: Node[] = useMemo(() => {
    const xs = [20, 250, 480, 710];
    const workerNodes: Node[] = ROLE_ORDER.map((role, i) => ({
      id: role,
      type: "worker",
      position: { x: xs[i], y: 150 },
      data: { role, status: workers[role].status, text: workers[role].text },
      draggable: false,
    }));

    const coordinator: Node = {
      id: "coordinator",
      position: { x: 380, y: 12 },
      data: { label: "Coordinator + Planner" },
      draggable: false,
      style: {
        background: "#1c1917",
        color: "#fafaf9",
        border: "none",
        borderRadius: 8,
        fontSize: 12,
        width: 200,
      },
    };

    const done = phase === "done";
    const memo: Node = {
      id: "memo",
      position: { x: 380, y: 320 },
      data: { label: done ? "Health Plan  ✓" : "Health Plan" },
      draggable: false,
      style: {
        background: done ? "#d1fae5" : "#f5f5f4",
        border: "2px solid",
        borderColor: done ? "#34d399" : "#d6d3d1",
        borderRadius: 8,
        fontSize: 12,
        width: 200,
      },
    };

    return [coordinator, ...workerNodes, memo];
  }, [workers, phase]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const role of ROLE_ORDER) {
      const running = workers[role].status === "running";
      out.push({
        id: `c-${role}`,
        source: "coordinator",
        target: role,
        animated: running,
      });
      out.push({
        id: `${role}-m`,
        source: role,
        target: "memo",
        animated: false,
      });
    }
    return out;
  }, [workers]);

  return (
    <div className="h-[420px] w-full rounded-xl border border-stone-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e7e5e4" />
      </ReactFlow>
    </div>
  );
}
