import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "lagoon"
  | "success"
  | "danger"
  | "caution"
  | "ember"
  | "neutral";

const tones: Record<BadgeTone, string> = {
  lagoon: "bg-lagoon-100 text-lagoon-800",
  success: "bg-success-100 text-success-800",
  danger: "bg-danger-100 text-danger-800",
  caution: "bg-caution-100 text-caution-800",
  ember: "bg-ember-100 text-ember-800",
  neutral: "bg-ink-100 text-ink-600",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
