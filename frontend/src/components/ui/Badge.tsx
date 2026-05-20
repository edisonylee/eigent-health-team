import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/**
 * Firecrawl is monochrome — every non-status badge collapses to either
 * Fire Orange (active/accent) or Code Blue (informational). The few
 * status-bearing tones stay distinct so the UI can still read run state.
 */
type Tone =
  | "neutral"
  | "accent" // Fire Orange — for active states, tool counts, etc.
  | "info" // Code Blue — informational only
  | "running" // animated active state
  | "done"
  | "error";

// Legacy tone aliases — kept so existing components keep compiling while we
// migrate. All collapse to the canonical Firecrawl tones above.
type LegacyTone = "blue" | "gold" | "fuchsia" | "purple" | "sky" | "teal" | "green" | "red";

const TONE: Record<Tone | LegacyTone, string> = {
  neutral: "bg-cloud-canvas text-stone-gray",
  accent: "bg-fire-orange/12 text-fire-orange",
  info: "bg-code-blue/12 text-code-blue",
  running: "bg-fire-orange/12 text-fire-orange",
  done: "bg-status-done/12 text-status-done",
  error: "bg-status-error/12 text-status-error",
  // Legacy → canonical
  blue: "bg-fire-orange/12 text-fire-orange",
  gold: "bg-fire-orange/12 text-fire-orange",
  fuchsia: "bg-fire-orange/12 text-fire-orange",
  purple: "bg-fire-orange/12 text-fire-orange",
  sky: "bg-code-blue/12 text-code-blue",
  teal: "bg-code-blue/12 text-code-blue",
  green: "bg-status-done/12 text-status-done",
  red: "bg-status-error/12 text-status-error",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone | LegacyTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-tag px-2 py-0.5 text-caption font-medium uppercase tracking-[0.1px]",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
