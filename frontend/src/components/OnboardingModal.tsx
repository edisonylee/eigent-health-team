import { useState } from "react";
import { useModelStatus, useUpdateModel } from "../lib/queries";
import { useStore } from "../store";

/**
 * Shown on first run when no model backend is usable.
 * Mirrors Eigent's onboarding: choose between cloud (OpenAI key) or local (Ollama).
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
    // The key itself isn't persisted client-side — it's set in the
    // backend's process env via a dedicated endpoint or .env. For now, the
    // user should set OPENAI_API_KEY in the environment and click "I've
    // added the key" — this modal just hot-switches the backend.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="border-b border-stone-200 bg-white px-6 py-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-700">
            Setup · choose a model backend
          </div>
          <h2 className="mt-1 font-serif text-xl text-stone-900">
            Welcome to HealthOS
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Pick a backend to run the four-agent Workforce against. You can
            switch at any time from Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPicked("openai")}
            className={
              "rounded-lg border p-4 text-left transition-colors " +
              (picked === "openai"
                ? "border-stone-700 bg-white"
                : "border-stone-200 bg-white/60 hover:border-stone-400")
            }
          >
            <div className="text-sm font-semibold text-stone-900">OpenAI</div>
            <div className="mt-1 text-xs text-stone-500">
              Cloud-hosted models (GPT-4o by default). Fastest onboarding;
              requires an API key.
            </div>
            <div className="mt-2 text-[11px] text-stone-400">
              key on machine:{" "}
              {status.openai_key_set ? "detected" : "not detected"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPicked("ollama")}
            className={
              "rounded-lg border p-4 text-left transition-colors " +
              (picked === "ollama"
                ? "border-stone-700 bg-white"
                : "border-stone-200 bg-white/60 hover:border-stone-400")
            }
          >
            <div className="text-sm font-semibold text-stone-900">
              Local · Ollama
            </div>
            <div className="mt-1 text-xs text-stone-500">
              Fully local. No API key, no cloud, no cost. Slower; needs
              Ollama running.
            </div>
            <div className="mt-2 text-[11px] text-stone-400">
              reachable: {status.ollama_reachable ? "yes" : "no"}
            </div>
          </button>
        </div>

        {picked === "openai" && (
          <div className="space-y-3 border-t border-stone-200 bg-white px-6 py-4">
            <label className="block text-xs text-stone-600">
              Set <code className="rounded bg-stone-100 px-1">OPENAI_API_KEY</code> in
              your backend environment (e.g. <code className="rounded bg-stone-100 px-1">.env</code>),
              then paste it here as confirmation.
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <button
              type="button"
              onClick={useOpenAI}
              disabled={update.isPending}
              className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {update.isPending ? "Switching…" : "Use OpenAI"}
            </button>
          </div>
        )}

        {picked === "ollama" && (
          <div className="space-y-3 border-t border-stone-200 bg-white px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-stone-600">
                Host
                <input
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="block text-xs text-stone-600">
                Model
                <input
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-500"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={useOllama}
              disabled={update.isPending}
              className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {update.isPending ? "Switching…" : "Use local Ollama"}
            </button>
            {!status.ollama_reachable && (
              <p className="text-[11px] text-amber-700">
                Ollama isn't reachable at {ollamaHost}. Start it with{" "}
                <code className="rounded bg-stone-100 px-1">ollama serve</code>.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
