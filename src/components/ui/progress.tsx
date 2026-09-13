import { cn } from "./cn";

export function Progress({
  value,
  tone = "lagoon",
  size = "md",
  className,
}: {
  value: number;
  tone?: "lagoon" | "success";
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "flex-1 overflow-hidden rounded-full bg-ink-100",
        size === "sm" ? "h-2.5" : "h-3",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "success" ? "bg-success-600" : "bg-lagoon-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
