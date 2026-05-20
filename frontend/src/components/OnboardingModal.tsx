import { useState } from "react";
import { useModelStatus, useUpdateModel } from "../lib/queries";
import { useStore } from "../store";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

/**
 * Shown on first run when no model backend is usable. Mirrors Eigent's
 * onboarding: choose cloud (OpenAI) or local (Ollama).
 */
export default function OnboardingModal() {
  const password = useStore((s) => s.password);
  const { data: status } = useModelStatus();
  const update = useUpdateModel();

  const [picked, setPicked] = useState<"openai" | "ollama" | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [ollamaHost, setOllamaHost] = useState(
    status?.ollama_host || "http://localhost:11434/v1",
  );
  const [ollamaModel, setOllamaModel] = useState(
    status?.ollama_model || "llama3.1:8b",
  );
  const [error, setError] = useState("");

  if (!status) return null;

  const useOpenAI = async () => {
    setError("");
    if (!openaiKey.trim()) {
      setError("Paste your OpenAI API key first.");
      return;
    }
    try {
      await update.mutateAsync({ password, backend: "openai" });
    } catch (e) {
      setError(String(e));
    }
  };

  const useOllama = async () => {
    setError("");
    try {
      await update.mutateAsync({
        password,
        backend: "ollama",
        ollama_host: ollamaHost,
        ollama_model: ollamaModel,
      });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cloud-canvas/80 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-card bg-paper-white shadow-card">
        <div className="border-b border-cloud-canvas px-6 py-5">
          <div className="flex items-center gap-2 text-caption uppercase tracking-[0.1px] text-slate-gray">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-fire-orange" />
            Setup · choose a model backend
          </div>
          <h2 className="mt-2 text-heading font-medium text-ink-black">
            Welcome to HealthOS
          </h2>
          <p className="mt-1 text-body text-slate-gray">
            Pick a backend to run the four-agent Workforce against. You can
            switch any time from Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2">
          <PickCard
            label="OpenAI"
            blurb="Cloud-hosted models (GPT-4o by default). Fastest onboarding; requires an API key."
            footnote={`key on machine: ${status.openai_key_set ? "detected" : "not detected"}`}
            picked={picked === "openai"}
            onClick={() => setPicked("openai")}
          />
          <PickCard
            label="Local · Ollama"
            blurb="Fully local. No API key, no cloud, no cost. Slower; needs Ollama running."
            footnote={`reachable: ${status.ollama_reachable ? "yes" : "no"}`}
            picked={picked === "ollama"}
            onClick={() => setPicked("ollama")}
          />
        </div>

        {picked === "openai" && (
          <div className="space-y-3 border-t border-frost-gray bg-cloud-canvas/60 px-6 py-4">
            <label className="block text-[12px] text-slate-gray">
              Set{" "}
              <code className="rounded bg-cloud-canvas px-1 text-ink-black">
                OPENAI_API_KEY
              </code>{" "}
              in your backend environment (e.g.{" "}
              <code className="rounded bg-cloud-canvas px-1 text-ink-black">.env</code>
              ), then paste it here as confirmation.
            </label>
            <Input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
            />
            <Button
              type="button"
              onClick={useOpenAI}
              disabled={update.isPending}
              className="w-full"
            >
              {update.isPending ? "Switching…" : "Use OpenAI"}
            </Button>
          </div>
        )}

        {picked === "ollama" && (
          <div className="space-y-3 border-t border-frost-gray bg-cloud-canvas/60 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] text-slate-gray">
                Host
                <Input
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="block text-[12px] text-slate-gray">
                Model
                <Input
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="mt-1"
                />
              </label>
            </div>
            <Button
              type="button"
              onClick={useOllama}
              disabled={update.isPending}
              className="w-full"
            >
              {update.isPending ? "Switching…" : "Use local Ollama"}
            </Button>
            {!status.ollama_reachable && (
              <p className="text-[11px] text-fire-orange">
                Ollama isn't reachable at {ollamaHost}. Start it with{" "}
                <code className="rounded bg-cloud-canvas px-1 text-ink-black">
                  ollama serve
                </code>
                .
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="border-t border-status-error/30 bg-status-error/10 px-6 py-2 text-[12px] text-status-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function PickCard({
  label,
  blurb,
  footnote,
  picked,
  onClick,
}: {
  label: string;
  blurb: string;
  footnote: string;
  picked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-default border p-4 text-left transition-all " +
        (picked
          ? "border-fire-orange/60 bg-paper-white/5 shadow-subtle-1"
          : "border-frost-gray bg-cloud-canvas/60 hover:border-frost-gray/30 hover:bg-paper-white/[0.03]")
      }
    >
      <div className="text-body font-semibold text-ink-black">{label}</div>
      <div className="mt-1 text-[12px] text-slate-gray">{blurb}</div>
      <div className="mt-2 text-[11px] text-silver-mist">{footnote}</div>
    </button>
  );
}
