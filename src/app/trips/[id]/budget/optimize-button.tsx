"use client";

import { useState, useTransition } from "react";
import { optimizeTripBudget } from "@/app/actions/budget";
import type { RemovedItem } from "@/lib/budget";
import { Button, Figure, formatInr } from "@/components/ui";

export function OptimizeButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    removedItems: RemovedItem[];
    savings: number;
  } | null>(null);

  function handleOptimize() {
    startTransition(async () => {
      const data = await optimizeTripBudget(tripId);
      setResult(data);
    });
  }

  return (
    <div className="mt-4">
      <Button size="sm" onClick={handleOptimize} disabled={pending}>
        {pending ? "Optimizing..." : "Optimize Budget"}
      </Button>

      {result && result.removedItems.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[0.875rem] font-medium text-ink-800">
            Removed {result.removedItems.length} items, saving{" "}
            <Figure>{formatInr(result.savings)}</Figure>
          </p>
          {result.removedItems.map((r, i) => (
            <div
              key={i}
              className="rounded-control border border-ink-200 bg-white p-3"
            >
              <p className="text-[0.875rem] font-medium text-ink-800">
                {r.item.title}
              </p>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">{r.reason}</p>
            </div>
          ))}
        </div>
      )}

      {result && result.removedItems.length === 0 && (
        <p className="text-[0.875rem] text-success-700 mt-3">
          Budget is already within limits.
        </p>
      )}
    </div>
  );
}
