import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: "none" | "dense" | "default";
  tone?: "default" | "success" | "selected";
};

const tones = {
  default: "bg-white border-ink-200",
  success: "bg-success-50 border-success-200",
  selected: "bg-success-50 border-success-600",
};

const paddings = {
  none: "",
  dense: "p-4",
  default: "p-5",
};

export function Card({
  interactive = false,
  padding = "default",
  tone = "default",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border shadow-card",
        tones[tone],
        paddings[padding],
        interactive &&
          "transition hover:shadow-lift hover:border-ink-300 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-[1.0625rem] font-semibold text-ink-800", className)}
      {...props}
    />
  );
}
