import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Tone =
  | "neutral"
  | "blue"
  | "green"
  | "fuchsia"
  | "gold"
  | "red"
  | "purple"
  | "sky"
  | "teal";

const TONE: Record<Tone, string> = {
  neutral: "bg-frost/10 text-ghostly-gray",
  blue: "bg-electric-blue/15 text-electric-blue",
  green: "bg-vivid-green/15 text-vivid-green",
  fuchsia: "bg-fuchsia-flare/15 text-fuchsia-flare",
  gold: "bg-goldenrod/15 text-goldenrod",
  red: "bg-crimson-red/15 text-crimson-red",
  purple: "bg-magenta-burst/15 text-magenta-burst",
  sky: "bg-sky-blue/15 text-sky-blue",
  teal: "bg-teal-glow/15 text-teal-glow",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
