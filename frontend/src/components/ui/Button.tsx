import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "secondary" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  // Pill CTAs per the system. Electric Blue primary, Ghostly Gray border on ghost.
  primary:
    "rounded-pill bg-electric-blue text-frost hover:brightness-110 active:brightness-95",
  ghost:
    "rounded-pill border border-ghostly-gray/40 bg-transparent text-frost hover:bg-frost/5",
  secondary:
    "rounded-default border border-ghostly-gray/20 bg-frost/5 text-frost hover:bg-frost/10",
  danger:
    "rounded-pill bg-crimson-red text-frost hover:brightness-110",
  subtle:
    "rounded-default bg-transparent text-ghostly-gray hover:bg-frost/5 hover:text-frost",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-body",
  lg: "px-6 py-2.5 text-body",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue/60",
        "disabled:opacity-40 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
});
