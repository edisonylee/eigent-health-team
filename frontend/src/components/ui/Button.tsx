import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "secondary" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  // Firecrawl Primary Action Button — Fire Orange filled, white text, pill.
  primary:
    "rounded-pill bg-fire-orange text-white hover:brightness-110 active:brightness-95",
  // Ghost Button — transparent, Ink Black text, subtle Cloud Canvas border on hover.
  ghost:
    "rounded-pill border border-cloud-canvas bg-transparent text-ink-black hover:bg-paper-white",
  secondary:
    "rounded-input border border-cloud-canvas bg-paper-white text-ink-black hover:bg-elevated-white",
  danger:
    "rounded-pill bg-status-error text-white hover:brightness-110",
  subtle:
    "rounded-input bg-transparent text-slate-gray hover:bg-paper-white hover:text-ink-black",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-5 py-2 text-body",
  lg: "px-6 py-2.5 text-body-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium",
        "transition-[background,color,opacity,box-shadow,filter] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-orange/40",
        "disabled:opacity-40 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
});
