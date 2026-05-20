import { Command } from "cmdk";
import { useUpdateModel } from "../lib/queries";
import { useStore } from "../store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}

export default function CommandPalette({ open, onOpenChange, onNavigate }: Props) {
  const password = useStore((s) => s.password);
  const update = useUpdateModel();

  if (!open) return null;

  const switchBackend = async (backend: "openai" | "ollama") => {
    await update.mutateAsync({ password, backend });
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/30 px-6 pt-32 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <Command.Input
            autoFocus
            placeholder="Type a command…"
            className="w-full border-b border-stone-200 px-4 py-3 text-sm outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto py-1">
            <Command.Empty className="px-4 py-3 text-xs text-stone-400">
              No matches.
            </Command.Empty>
            <Command.Group heading="Navigate" className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400">
              <Command.Item
                onSelect={() => {
                  onNavigate("/");
                }}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Run a new plan
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/agents")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Open agent roster
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/check-in")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Daily check-in
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/evals")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Evals dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/settings")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Settings
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Model backend" className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400">
              <Command.Item
                onSelect={() => switchBackend("openai")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Switch to OpenAI
              </Command.Item>
              <Command.Item
                onSelect={() => switchBackend("ollama")}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-stone-800 aria-selected:bg-stone-100"
              >
                Switch to local Ollama
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
