"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { generateTripItinerary } from "@/app/actions/itinerary";
import { Button, Alert } from "@/components/ui";
import { Loader2 } from "lucide-react";

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
      const t = setTimeout(() => setStageIndex(0), 0);
      return () => clearTimeout(t);
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

export function GenerateButton({ tripId, initialStatus }: { tripId: string, initialStatus?: string }) {
  const [, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(initialStatus === "generating");
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<boolean>(false);
  const [season, setSeason] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/status`);
        const data = await res.json();

        if (data.status === "planning") {
          if (pollRef.current) clearInterval(pollRef.current);
          window.location.reload();
        } else if (data.status === "draft") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsGenerating(false);
          setError("We couldn't generate this itinerary right now. Your trip details are saved — please try again.");
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 2000);
  }, [tripId]);

  // Auto-start polling if we mounted in generating state
  useEffect(() => {
    if (initialStatus === "generating") {
      startPolling();
    }
  }, [initialStatus, startPolling]);

  const stageLabel = useProgressStages(isGenerating);

  function handleGenerate() {
    if (isGenerating) return; // prevent double-click
    setError(null);
    setFallbackNotice(false);
    setSeason(null);
    setIsGenerating(true);

    startTransition(async () => {
      const result = await generateTripItinerary(tripId);
      if (!result.success) {
        setIsGenerating(false);
        setError(result.error);
        return;
      }

      // Poll for status until the background job completes
      startPolling();
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

      {season && !isGenerating && (
        <p className="text-xs text-muted-foreground">
          Itinerary optimised for{" "}
          <span className="font-medium capitalize">{season.replace("_", "-")}</span> travel.
        </p>
      )}

      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{stageLabel}</span>
          </span>
        ) : (
          "Generate Itinerary"
        )}
      </Button>
    </div>
  );
}
