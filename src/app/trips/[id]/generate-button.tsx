"use client";

import { useState, useTransition } from "react";
import { generateTripItinerary } from "@/app/actions/itinerary";
import { Button, Alert } from "@/components/ui";

export function GenerateButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateTripItinerary(tripId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert tone="danger">{error}</Alert>
      )}
      <Button onClick={handleGenerate} disabled={pending}>
        {pending ? "Generating..." : "Generate Itinerary"}
      </Button>
    </div>
  );
}
