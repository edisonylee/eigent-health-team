import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const base =
  "w-full rounded-default bg-frost/5 px-3 py-2 text-body text-frost " +
  "placeholder:text-slate-gray outline-none transition-[box-shadow,background] " +
  "focus:bg-frost/10 focus:shadow-subtle-1 " +
  "disabled:opacity-40 disabled:pointer-events-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(base, "resize-y leading-relaxed", className)}
      {...props}
    />
  );
});
