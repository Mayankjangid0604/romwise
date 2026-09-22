"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface TripProgressProps {
  hasItinerary: boolean;
  hasPacking: boolean;
  hasBudget: boolean;
  hasGroup: boolean;
  hasTransit: boolean;
  hasStay: boolean;
}

const checkItems = [
  { key: "hasItinerary", label: "Itinerary" },
  { key: "hasPacking", label: "Packing list" },
  { key: "hasBudget", label: "Budget set" },
  { key: "hasGroup", label: "Group members" },
  { key: "hasTransit", label: "Transit booked" },
  { key: "hasStay", label: "Stay booked" },
] as const;

export function TripProgress(props: TripProgressProps) {
  const completed = checkItems.filter((item) => props[item.key]).length;
  const total = checkItems.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background:
                pct === 100
                  ? "var(--color-success-600)"
                  : pct >= 50
                  ? "var(--color-lagoon-500)"
                  : "var(--color-ember-500)",
            }}
          />
        </div>
        <span className="text-xs font-semibold text-ink-600 tabular w-10 text-right">
          {pct}%
        </span>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {checkItems.map(({ key, label }) => {
          const done = props[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-1.5 text-xs py-1 ${
                done ? "text-success-700" : "text-ink-400"
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
