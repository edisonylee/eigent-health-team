import { useState } from "react";
import {
  useMCPServers,
  useModelStatus,
  useReconnectMCP,
  useUpdateModel,
} from "../lib/queries";
import { useStore } from "../store";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import Agents from "./Agents";
import Evals from "./Evals";

export default function Settings() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-heading font-semibold text-ink-black">Settings</h1>
        <p className="mb-6 text-body text-slate-gray">
          Configure the model backend, inspect MCP servers, and manage local
          data.
        </p>

        <Tabs defaultValue="model">
          <TabsList className="mb-6">
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="mcp">MCP servers</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="evals">Evals</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="model">
            <ModelTab />
          </TabsContent>
          <TabsContent value="mcp">
            <MCPTab />
          </TabsContent>
          <TabsContent value="agents">
            <Agents />
          </TabsContent>
          <TabsContent value="evals">
            <Evals />
          </TabsContent>
          <TabsContent value="data">
            <DataTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ModelTab() {
  const password = useStore((s) => s.password);
  const { data: status } = useModelStatus();
  const update = useUpdateModel();
  const [openaiModel, setOpenaiModel] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaHost, setOllamaHost] = useState("");
  const [error, setError] = useState("");

  if (!status) return <div className="text-body text-slate-gray">loading…</div>;

  const submit = async (backend: "openai" | "ollama") => {
    setError("");
    try {
      await update.mutateAsync({
        password,
        backend,
        openai_model: openaiModel || undefined,
        ollama_model: ollamaModel || undefined,
        ollama_host: ollamaHost || undefined,
      });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-5">
      <Card surface="starless">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
              Active backend
            </div>
            <div className="mt-1 font-mono text-subheading text-ink-black">
              {status.backend} · {status.model}
            </div>
          </div>
          <div className="space-y-1 text-right text-[11px] text-slate-gray">
            <div>
              OpenAI key:{" "}
              <span className={status.openai_key_set ? "text-status-done" : "text-slate-gray"}>
                {status.openai_key_set ? "✓" : "—"}
              </span>
            </div>
            <div>
              Ollama reachable:{" "}
              <span className={status.ollama_reachable ? "text-status-done" : "text-slate-gray"}>
                {status.ollama_reachable ? "✓" : "—"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Section title="OpenAI · cloud default">
        <label className="block text-[12px] text-slate-gray">
          Model
          <Input
            value={openaiModel}
            onChange={(e) => setOpenaiModel(e.target.value)}
            placeholder={status.openai_model}
            className="mt-1"
          />
        </label>
        <Button type="button" onClick={() => submit("openai")} disabled={update.isPending}>
          Use OpenAI
        </Button>
      </Section>

      <Section title="Ollama · local opt-in">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-slate-gray">
            Host
            <Input
              value={ollamaHost}
              onChange={(e) => setOllamaHost(e.target.value)}
              placeholder={status.ollama_host}
              className="mt-1"
            />
          </label>
          <label className="block text-[12px] text-slate-gray">
            Model
            <Input
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder={status.ollama_model}
              className="mt-1"
            />
          </label>
        </div>
        <Button type="button" onClick={() => submit("ollama")} disabled={update.isPending}>
          Use local Ollama
        </Button>
      </Section>

      {error && (
        <div className="rounded-default border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
          {error}
        </div>
      )}
    </div>
  );
}

function MCPTab() {
  const password = useStore((s) => s.password);
  const { data: servers } = useMCPServers();
  const reconnect = useReconnectMCP();

  if (!servers) return <div className="text-body text-slate-gray">loading…</div>;

  return (
    <div className="space-y-3">
      {servers.map((s) => {
        const tone =
          s.status === "connected"
            ? "green"
            : s.status === "disabled"
              ? "neutral"
              : "gold";
        return (
          <Card key={s.name} surface="starless">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-body text-ink-black">{s.name}</div>
                <div className="mt-1 text-[11px] text-slate-gray">
                  {s.error || (s.tools.length === 0 ? "no tools" : `${s.tools.length} tools`)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={tone}>{s.status}</Badge>
                {s.status !== "disabled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => reconnect.mutate({ name: s.name, password })}
                    disabled={reconnect.isPending}
                  >
                    Reconnect
                  </Button>
                )}
              </div>
            </div>
            {s.tools.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {s.tools.map((t) => (
                  <span
                    key={t.name}
                    className="rounded bg-paper-white/5 px-2 py-0.5 font-mono text-[10px] text-stone-gray"
                    title={t.description}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function DataTab() {
  const password = useStore((s) => s.password);
  const [wipeText, setWipeText] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const exportDb = () => {
    const url = `/api/data/export?password=${encodeURIComponent(password)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthos.db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const wipe = async () => {
    setMessage(null);
    setWipeBusy(true);
    try {
      const r = await fetch("/api/data/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: wipeText }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
      setMessage({
        kind: "ok",
        text: `Wiped: ${(body.deleted as string[]).join(", ") || "(empty)"}`,
      });
      setWipeText("");
    } catch (e) {
      setMessage({ kind: "err", text: String(e) });
    } finally {
      setWipeBusy(false);
    }
  };

  const openDataDir = () => {
    const w = window as unknown as { healthos?: { openDataDir?: () => void } };
    if (w.healthos?.openDataDir) {
      w.healthos.openDataDir();
    } else {
      setMessage({
        kind: "err",
        text: "Open in Finder is only available in the Electron build. Path: ~/.healthos/",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card surface="starless">
        <p className="text-body text-slate-gray">
          Local data lives at{" "}
          <code className="rounded bg-paper-white/10 px-1 text-ink-black">~/.healthos/</code> —
          SQLite DB, embedded Chroma vector store, and the notes directory the
          filesystem MCP server reads from.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={exportDb}>
          Export DB
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={openDataDir}>
          Open data folder
        </Button>
      </div>

      <Card surface="starless" className="border border-status-error/30">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-status-error">
          Danger zone
        </div>
        <p className="mt-1.5 text-body text-stone-gray">
          Wipe all local data — DB, vector store, notes. Type{" "}
          <code className="rounded bg-paper-white/10 px-1 text-ink-black">WIPE</code> to
          confirm.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            placeholder="WIPE"
            className="flex-1"
          />
          <Button
            variant="danger"
            type="button"
            onClick={wipe}
            disabled={wipeText !== "WIPE" || wipeBusy}
          >
            {wipeBusy ? "Wiping…" : "Wipe local data"}
          </Button>
        </div>
      </Card>

      {message && (
        <div
          className={
            "rounded-default border px-3 py-2 text-[12px] " +
            (message.kind === "ok"
              ? "border-status-done/30 bg-status-done/10 text-status-done"
              : "border-fire-orange/30 bg-fire-orange/10 text-fire-orange")
          }
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card surface="starless">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-silver-mist">
        {title}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}
