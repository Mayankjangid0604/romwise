"use client";

import { useTransition } from "react";
import { generateTripItinerary } from "@/app/actions/itinerary";
import { Button } from "@/components/ui";

export function GenerateButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => startTransition(() => generateTripItinerary(tripId))}
      disabled={pending}
    >
      {pending ? "Generating..." : "Generate Itinerary"}
    </Button>
  );
}
