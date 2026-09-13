import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-lagoon-700 hover:text-lagoon-800 transition-colors"
    >
      <span aria-hidden="true">&larr;</span>
      {children}
    </Link>
  );
}

export function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      {backHref && (
        <div className="mb-4">
          <BackLink href={backHref}>{backLabel ?? "Back"}</BackLink>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900">
            {title}
          </h1>
          {subtitle && <p className="text-ink-600 mt-1">{subtitle}</p>}
          {meta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[0.8125rem] text-ink-500">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}

export function SectionHeading({
  children,
  hint,
  actions,
}: {
  children: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-800">
          {children}
        </h2>
        {hint && <p className="text-[0.8125rem] text-ink-500 mt-1">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
