import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** Numeric values — costs, distances, scores — in the mono face with aligned figures. */
export function Figure({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("font-mono tabular", className)} {...props} />
  );
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
