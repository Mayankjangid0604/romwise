"use client";

import Link from "next/link";
import { PageShell, Button, buttonStyles } from "@/components/ui";

export default function TripError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <div className="rounded-card border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">
          Failed to load trip
        </h1>
        <p className="text-ink-600 mt-2 mb-7 max-w-md mx-auto">
          Something went wrong loading this page. The trip may not exist or there
          may be a temporary issue.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
