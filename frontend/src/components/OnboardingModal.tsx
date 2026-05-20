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
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-eclipse/80 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-card bg-starless-night shadow-xl shadow-subtle-1">
        <div className="bg-gradient-nebula px-6 py-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-frost/85">
            Setup · choose a model backend
          </div>
          <h2 className="mt-2 text-heading-sm font-semibold text-frost">
            Welcome to HealthOS
          </h2>
          <p className="mt-1 text-body text-frost/85">
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
          <div className="space-y-3 border-t border-twilight-ink bg-midnight-eclipse/40 px-6 py-4">
            <label className="block text-[12px] text-slate-gray">
              Set{" "}
              <code className="rounded bg-frost/10 px-1 text-frost">
                OPENAI_API_KEY
              </code>{" "}
              in your backend environment (e.g.{" "}
              <code className="rounded bg-frost/10 px-1 text-frost">.env</code>
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
          <div className="space-y-3 border-t border-twilight-ink bg-midnight-eclipse/40 px-6 py-4">
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
              <p className="text-[11px] text-goldenrod">
                Ollama isn't reachable at {ollamaHost}. Start it with{" "}
                <code className="rounded bg-frost/10 px-1 text-frost">
                  ollama serve
                </code>
                .
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="border-t border-crimson-red/30 bg-crimson-red/10 px-6 py-2 text-[12px] text-crimson-red">
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
          ? "border-electric-blue/60 bg-frost/5 shadow-subtle-1"
          : "border-twilight-ink bg-midnight-eclipse/40 hover:border-frost/30 hover:bg-frost/[0.03]")
      }
    >
      <div className="text-body font-semibold text-frost">{label}</div>
      <div className="mt-1 text-[12px] text-slate-gray">{blurb}</div>
      <div className="mt-2 text-[11px] text-pewter">{footnote}</div>
    </button>
  );
}
