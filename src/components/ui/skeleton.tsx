import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** Placeholder block for loading states. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-card bg-ink-100", className)} {...props} />;
}

/**
 * Wrapper for route-level loading UI (loading.tsx). Announces the wait to screen
 * readers; `data-loading` lets tests assert that feedback appears on navigation.
 */
export function LoadingState({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" data-loading className={cn("space-y-6", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
