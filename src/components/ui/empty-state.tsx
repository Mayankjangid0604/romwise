import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink-700">{title}</p>
      {hint && <p className="text-[0.875rem] text-ink-500 mt-1.5">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
