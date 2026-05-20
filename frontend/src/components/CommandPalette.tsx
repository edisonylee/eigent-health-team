import { Command } from "cmdk";
import { useUpdateModel } from "../lib/queries";
import { useStore } from "../store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}

const itemCls =
  "cursor-pointer rounded-default px-3 py-2 text-body text-ink-black aria-selected:bg-paper-white/5 aria-selected:shadow-subtle-1";
const groupHeadingCls =
  "px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-silver-mist";

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-cloud-canvas/70 px-6 pt-32 backdrop-blur-md"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-card bg-paper-white shadow-xl shadow-subtle-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <Command.Input
            autoFocus
            placeholder="Type a command…"
            className="w-full border-b border-frost-gray bg-transparent px-4 py-3 text-body text-ink-black placeholder:text-slate-gray outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-3 text-[12px] text-silver-mist">
              No matches.
            </Command.Empty>
            <Command.Group heading="Navigate" className={groupHeadingCls}>
              <Command.Item onSelect={() => onNavigate("/")} className={itemCls}>
                Run a new plan
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/agents")}
                className={itemCls}
              >
                Open agent roster
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/check-in")}
                className={itemCls}
              >
                Daily check-in
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/memory-graph")}
                className={itemCls}
              >
                Memory graph
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/evals")}
                className={itemCls}
              >
                Evals dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => onNavigate("/settings")}
                className={itemCls}
              >
                Settings
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Model backend" className={groupHeadingCls}>
              <Command.Item
                onSelect={() => switchBackend("openai")}
                className={itemCls}
              >
                Switch to OpenAI
              </Command.Item>
              <Command.Item
                onSelect={() => switchBackend("ollama")}
                className={itemCls}
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
