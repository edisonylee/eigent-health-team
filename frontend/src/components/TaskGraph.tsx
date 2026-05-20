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
        (tc) =>
          tc.name === "search_duckduckgo" || tc.name === "search_brave",
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
          cachedTokens: w.cachedTokens,
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

    // Dark coordinator pill — uses inline style because React Flow accepts
    // plain HTML/CSS for non-custom nodes.
    const coordinator: Node = {
      id: "coordinator",
      position: { x: 380, y: 12 },
      data: { label: "Coordinator + Planner" },
      draggable: false,
      style: {
        background: "var(--color-starless-night)",
        color: "var(--color-frost)",
        border: "1px solid var(--color-twilight-ink)",
        borderRadius: 9999,
        fontSize: 12,
        width: 200,
        padding: "6px 12px",
      },
    };

    const done = phase === "done";
    const memo: Node = {
      id: "memo",
      position: { x: 380, y: 320 },
      data: { label: done ? "Health Plan  ✓" : "Health Plan" },
      draggable: false,
      style: {
        background: done ? "var(--color-vivid-green)" : "var(--color-starless-night)",
        color: done ? "var(--color-midnight-eclipse)" : "var(--color-frost)",
        border: "1px solid",
        borderColor: done ? "var(--color-vivid-green)" : "var(--color-twilight-ink)",
        borderRadius: 9,
        fontSize: 12,
        width: 200,
        padding: "8px 12px",
        fontWeight: 500,
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
      style: {
        stroke: labPanel ? "var(--color-fuchsia-flare)" : "var(--color-twilight-ink)",
        strokeDasharray: labPanel ? undefined : "4 4",
      },
    });
    for (const role of ROLE_ORDER) {
      const running = workers[role].status === "running";
      const done = workers[role].status === "done";
      out.push({
        id: `c-${role}`,
        source: "coordinator",
        target: role,
        animated: running,
        style: {
          stroke: running
            ? "var(--color-electric-blue)"
            : done
              ? "var(--color-vivid-green)"
              : "var(--color-twilight-ink)",
        },
      });
      out.push({
        id: `${role}-m`,
        source: role,
        target: "memo",
        animated: false,
        style: {
          stroke: done ? "var(--color-vivid-green)" : "var(--color-twilight-ink)",
        },
      });
    }
    return out;
  }, [workers, labLoading, labPanel]);

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-card border border-twilight-ink bg-starless-night">
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
        <Background color="var(--color-twilight-ink)" gap={24} size={1} />
      </ReactFlow>
    </div>
  );
}
