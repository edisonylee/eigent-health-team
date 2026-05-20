import { useMCPServers, useModelStatus, usePrompts } from "../lib/queries";
import { ROLE_LABEL, ROLE_ORDER, Role } from "../store";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";

const ROLE_TOOLS: Record<Role, string[]> = {
  researcher: [
    "query_health_graph",
    "search_health_kb",
    "list_notes",
    "read_notes",
    "search_brave",
  ],
  analyst: [],
  critic: [],
  summarizer: [],
};

const TOOL_TO_SERVER: Record<string, string> = {
  query_health_graph: "health_kb",
  search_health_kb: "health_kb",
  list_notes: "filesystem",
  read_notes: "filesystem",
  search_brave: "brave_search",
};

const ROLE_BLURB: Record<Role, string> = {
  researcher:
    "Gathers evidence from a curated graph, a vector KB, and (optionally) the open web.",
  analyst: "Picks the 3–4 highest-leverage focus areas from the profile.",
  critic: "Pressure-tests the plan for risks, contraindications, and red flags.",
  summarizer: "Assembles the final personalized health plan in markdown.",
};

const ROLE_TONE: Record<Role, React.ComponentProps<typeof Badge>["tone"]> = {
  researcher: "sky",
  analyst: "purple",
  critic: "gold",
  summarizer: "green",
};

export default function Agents() {
  const { data: prompts } = usePrompts();
  const { data: status } = useModelStatus();
  const { data: servers } = useMCPServers();

  const connectedServers = new Set(
    (servers || []).filter((s) => s.status === "connected").map((s) => s.name),
  );
  const isToolLive = (tool: string) => {
    const server = TOOL_TO_SERVER[tool];
    return server ? connectedServers.has(server) : false;
  };

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-heading font-semibold text-ink-black">
          Agent roster
        </h1>
        <p className="mb-6 text-body text-slate-gray">
          Four specialists, coordinated by a CAMEL Workforce. Each can ask the
          user a clarifying question mid-run via the in-process{" "}
          <code className="rounded bg-paper-white/10 px-1 text-ink-black">
            request_human_input
          </code>{" "}
          tool.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ROLE_ORDER.map((role) => (
            <Card key={role} surface="starless" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Badge tone={ROLE_TONE[role]}>{role}</Badge>
                {status && (
                  <span className="font-mono text-[10px] text-silver-mist">
                    {status.backend} · {status.model}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-subheading font-medium text-ink-black">
                  {ROLE_LABEL[role]}
                </h2>
                <p className="mt-1 text-body text-slate-gray">
                  {ROLE_BLURB[role]}
                </p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
                  Tools
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ROLE_TOOLS[role].map((t) => {
                    const live = isToolLive(t);
                    return (
                      <Badge
                        key={t}
                        tone={live ? "green" : "neutral"}
                        title={
                          live
                            ? `via MCP (${TOOL_TO_SERVER[t]})`
                            : "MCP server not connected"
                        }
                      >
                        {t}
                      </Badge>
                    );
                  })}
                  <Badge
                    tone="fuchsia"
                    title="In-process — blocking semantic ties to the runner thread"
                  >
                    request_human_input · in-process
                  </Badge>
                </div>
              </div>

              {prompts && (
                <details className="text-[12px] text-slate-gray">
                  <summary className="cursor-pointer text-slate-gray hover:text-ink-black">
                    system prompt
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-default border border-frost-gray bg-cloud-canvas p-3 font-mono text-[11px] text-stone-gray">
                    {prompts[role]}
                  </pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
