"use client";

import { useEffect } from "react";

export function RecentTracker({ 
  type, 
  tripId, 
  destinationId 
}: { 
  type: "VIEW_TRIP" | "VIEW_DESTINATION";
  tripId?: string;
  destinationId?: string;
}) {
  useEffect(() => {
    const track = async () => {
      try {
        await fetch("/api/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, tripId, destinationId }),
        });
      } catch (err) {
        console.error("Failed to track recent activity", err);
      }
    };

    track();
  }, [type, tripId, destinationId]);

  return null;
}
