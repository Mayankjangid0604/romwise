import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "caution" | "danger" | "success" | "info";

const tones: Record<AlertTone, { box: string; title: string; body: string }> = {
  caution: {
    box: "bg-caution-50 border-caution-200",
    title: "text-caution-800",
    body: "text-caution-700",
  },
  danger: {
    box: "bg-danger-50 border-danger-200",
    title: "text-danger-800",
    body: "text-danger-700",
  },
  success: {
    box: "bg-success-50 border-success-200",
    title: "text-success-800",
    body: "text-success-700",
  },
  info: {
    box: "bg-lagoon-50 border-lagoon-200",
    title: "text-lagoon-800",
    body: "text-lagoon-700",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div className={cn("rounded-card border p-4", t.box, className)}>
      {title && <p className={cn("font-medium text-[0.9375rem]", t.title)}>{title}</p>}
      {children && (
        <div className={cn("text-[0.8125rem]", t.body, title && "mt-1")}>
          {children}
        </div>
      )}
    </div>
  );
}
