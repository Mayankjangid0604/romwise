import type { ReactNode } from "react";
import { cn } from "./cn";

const widths = {
  narrow: "max-w-md",
  form: "max-w-2xl",
  default: "max-w-4xl",
};

export function PageShell({
  width = "default",
  children,
  className,
}: {
  width?: keyof typeof widths;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto px-4 py-8 sm:px-6", widths[width], className)}>
      {children}
    </div>
  );
}

export function CenteredShell({
  width = "narrow",
  children,
}: {
  width?: keyof typeof widths;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className={cn("w-full", widths[width])}>{children}</div>
    </div>
  );
}
