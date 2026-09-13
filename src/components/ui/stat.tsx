import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatTone = "default" | "positive" | "negative" | "muted";

const figureTones: Record<StatTone, string> = {
  default: "text-ink-900",
  positive: "text-success-700",
  negative: "text-danger-600",
  muted: "text-ink-400",
};

export function Stat({
  label,
  value,
  detail,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-ink-200 bg-white shadow-card p-4 text-center",
        className,
      )}
    >
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p
        className={cn(
          "font-mono tabular text-xl font-semibold mt-1.5",
          figureTones[tone],
        )}
      >
        {value}
      </p>
      {detail && <p className="text-[0.6875rem] text-ink-400 mt-1">{detail}</p>}
    </div>
  );
}
