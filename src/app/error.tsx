"use client";

import { Button } from "@/components/ui";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          Something went wrong
        </h1>
        <p className="text-ink-600 mt-2 mb-7">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
