import { useMemo } from "react";
import ReactFlow, { Background, Edge, Node } from "reactflow";
import { ROLE_ORDER, Role, useStore } from "../store";
import ParserNode from "./ParserNode";
import WorkerNode from "./WorkerNode";

const nodeTypes = { worker: WorkerNode, parser: ParserNode };
const WORKER_IDS = new Set<string>(ROLE_ORDER);

/** Live node graph: Lab Parser → coordinator → 4 workers → memo. */
export default function TaskGraph() {
  const workers = useStore((s) => s.workers);
  const phase = useStore((s) => s.phase);
  const labPanel = useStore((s) => s.labPanel);
  const labLoading = useStore((s) => s.labLoading);
  const setExpanded = useStore((s) => s.setExpanded);

  const nodes: Node[] = useMemo(() => {
    const xs = [20, 250, 480, 710];
    const workerNodes: Node[] = ROLE_ORDER.map((role, i) => {
      const w = workers[role];
      const kbCount = w.toolCalls.filter(
        (tc) => tc.name === "search_health_kb",
      ).length;
      const webCount = w.toolCalls.filter(
        (tc) => tc.name === "search_duckduckgo",
      ).length;
      const graphCount = w.toolCalls.filter(
        (tc) => tc.name === "query_health_graph",
      ).length;
      return {
        id: role,
        type: "worker",
        position: { x: xs[i], y: 150 },
        data: {
          role,
          status: w.status,
          text: w.text,
          promptTokens: w.promptTokens,
          completionTokens: w.completionTokens,
          cost: w.cost,
          kbCount,
          webCount,
          graphCount,
        },
        draggable: false,
      };
    });

    const parserStatus = labLoading
      ? "running"
      : labPanel && labPanel.biomarkers.length > 0
        ? "done"
        : "idle";

    const parser: Node = {
      id: "lab_parser",
      type: "parser",
      position: { x: 376, y: -120 },
      data: {
        status: parserStatus,
        biomarkerCount: labPanel?.biomarkers.length ?? 0,
      },
      draggable: false,
    };

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

    return [parser, coordinator, ...workerNodes, memo];
  }, [workers, phase, labLoading, labPanel]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    out.push({
      id: "parser-coordinator",
      source: "lab_parser",
      target: "coordinator",
      animated: labLoading,
      style: { stroke: labPanel ? "#8b5cf6" : "#d6d3d1", strokeDasharray: labPanel ? undefined : "4 4" },
    });
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
  }, [workers, labLoading, labPanel]);

  return (
    <div className="h-[500px] w-full rounded-xl border border-stone-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_, node) => {
          if (WORKER_IDS.has(node.id)) setExpanded(node.id as Role);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e7e5e4" />
      </ReactFlow>
    </div>
  );
}
