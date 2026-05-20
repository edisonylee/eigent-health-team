import * as RadixTabs from "@radix-ui/react-tabs";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RadixTabs.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 border-b border-frost-gray",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof RadixTabs.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        "border-b-2 border-transparent px-3 py-2 text-[13px] text-slate-gray transition-colors",
        "hover:text-ink-black",
        "data-[state=active]:border-fire-orange data-[state=active]:text-ink-black",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-orange/40",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RadixTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <RadixTabs.Content
      ref={ref}
      className={cn("focus:outline-none", className)}
      {...props}
    />
  );
});
