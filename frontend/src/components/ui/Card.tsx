import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

type Surface = "starless" | "midnight" | "frost" | "gradient-nebula" | "gradient-twilight";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: Surface;
  /** Apply the default 24px card radius vs the smaller 9px "default" radius. */
  shape?: "card" | "default";
  /** Add a 1px inset white shadow border (per design system). */
  inset?: boolean;
}

const SURFACE: Record<Surface, string> = {
  // Starless Night = subtle elevated card on the dark canvas
  starless: "bg-starless-night text-frost",
  midnight: "bg-midnight-eclipse text-frost",
  // Light card for "rhythmic contrast" — memo + evals
  frost: "bg-frost text-ash-gray shadow-card",
  "gradient-nebula": "bg-gradient-nebula text-frost",
  "gradient-twilight": "bg-gradient-twilight text-frost",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { surface = "starless", shape = "card", inset = true, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        shape === "card" ? "rounded-card p-6" : "rounded-default p-4",
        SURFACE[surface],
        inset && surface !== "frost" ? "shadow-subtle-1" : "",
        className,
      )}
      {...props}
    />
  );
});
