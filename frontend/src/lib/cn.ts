import clsx, { type ClassValue } from "clsx";

/** Class-name composer. Thin alias so callsites don't import clsx directly. */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
