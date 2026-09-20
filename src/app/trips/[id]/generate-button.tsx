"use client";

import { useState, useTransition, useEffect } from "react";
import { generateTripItinerary } from "@/app/actions/itinerary";
import { Button, Alert } from "@/components/ui";

// UX-002: Generation progress stages shown during the ~10–20s Gemini call
const PROGRESS_STAGES = [
  { label: "Resolving destination…", durationMs: 800 },
  { label: "Finding candidate places for your trip…", durationMs: 2500 },
  { label: "Scoring places by your preferences and season…", durationMs: 2000 },
  { label: "Crafting your personalised day-by-day plan…", durationMs: 5000 },
  { label: "Validating itinerary against known places…", durationMs: 2000 },
  { label: "Finalising your trip…", durationMs: 99999 },
];

function useProgressStages(active: boolean) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStageIndex(0);
      return;
    }

    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function schedule(i: number) {
      if (i >= PROGRESS_STAGES.length - 1) return;
      const timer = setTimeout(() => {
        idx = i + 1;
        setStageIndex(idx);
        schedule(idx);
      }, PROGRESS_STAGES[i].durationMs);
      timers.push(timer);
    }

    schedule(0);
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return PROGRESS_STAGES[stageIndex].label;
}

export function GenerateButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<boolean>(false);
  const [season, setSeason] = useState<string | null>(null);

  const stageLabel = useProgressStages(pending);

  function handleGenerate() {
    setError(null);
    setFallbackNotice(false);
    setSeason(null);
    startTransition(async () => {
      const result = await generateTripItinerary(tripId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      // Start polling
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/trips/${tripId}/status`);
          const data = await res.json();
          
          if (data.status === "planning") {
            clearInterval(pollInterval);
            window.location.reload(); // Reload to show the itinerary
          } else if (data.status === "draft") {
            clearInterval(pollInterval);
            setError("Generation failed. Please try again.");
          }
        } catch (err) {
          console.error("Failed to poll status:", err);
        }
      }, 2000);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert tone="danger">{error}</Alert>
      )}

      {/* TECH-002: Fallback notice */}
      {fallbackNotice && !error && (
        <Alert tone="info">
          Your itinerary was built using our curated places database. AI personalisation was
          unavailable this time — you can re-generate to try again, or edit any activity manually.
        </Alert>
      )}

      {/* Season contextual hint */}
      {season && !pending && (
        <p className="text-xs text-muted-foreground">
          Itinerary optimised for{" "}
          <span className="font-medium capitalize">{season.replace("_", "-")}</span> travel.
        </p>
      )}

      <Button onClick={handleGenerate} disabled={pending}>
        {pending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{stageLabel}</span>
          </span>
        ) : (
          "Generate Itinerary"
        )}
      </Button>
    </div>
  );
}
