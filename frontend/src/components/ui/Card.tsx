import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

type Surface = "paper" | "canvas" | "elevated" | "hero" | "starless";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * paper    — default Paper White feature card (most common)
   * canvas   — transparent, sits on Cloud Canvas page bg with just a border
   * elevated — pure white with the full multi-layer shadow stack
   * hero     — Paper White, full shadow, used for the run-page banner
   * starless — legacy alias for `paper`, kept so existing callsites work
   */
  surface?: Surface;
  /** 16px (`card`) or 8px (`default`) corner radius. */
  shape?: "card" | "default";
}

const SURFACE: Record<Surface, string> = {
  paper: "bg-paper-white text-ink-black shadow-xl",
  canvas: "bg-transparent text-ink-black border border-frost-gray",
  elevated: "bg-elevated-white text-ink-black shadow-card",
  hero: "bg-paper-white text-ink-black shadow-card",
  starless: "bg-paper-white text-ink-black shadow-xl",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { surface = "paper", shape = "card", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        shape === "card" ? "rounded-card p-6" : "rounded-default p-4",
        SURFACE[surface],
        className,
      )}
      {...props}
    />
  );
});
