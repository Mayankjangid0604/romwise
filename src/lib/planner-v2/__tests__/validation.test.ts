import { describe, it, expect } from "vitest";
import { validateDays } from "../validation";
import type { V2GeneratedDay } from "../types";

describe("Planner V2 Validation", () => {
  it("detects overlaps, boundaries, and duplicates", () => {
    const days: V2GeneratedDay[] = [{
      dayNumber: 1,
      date: new Date(),
      items: [
        {
          placeId: "p1", title: "P1", description: "", category: "history",
          startTime: "08:00", endTime: "10:00",
          estimatedCostInr: null, costSource: "unknown", lat: null, lng: null,
          reasoning: "", order: 1
        },
        {
          placeId: "temp_123", // hallucinated
          title: "P2", description: "", category: "culture",
          startTime: "09:30", // overlaps with P1
          endTime: "11:00",
          estimatedCostInr: 100, costSource: "db", lat: null, lng: null,
          reasoning: "", order: 2
        },
        {
          placeId: "p1", // duplicate
          title: "P1 Again", description: "", category: "history",
          startTime: "25:00", // out of bounds
          endTime: "26:00",
          estimatedCostInr: 0, costSource: "free", lat: null, lng: null,
          reasoning: "", order: 3
        }
      ]
    }];

    const metrics = validateDays(days);
    
    expect(metrics.selectedCount).toBe(3);
    expect(metrics.duplicatePlaceCount).toBe(1); // p1 is used twice
    expect(metrics.timeOverlapCount).toBe(1); // p2 overlaps p1
    expect(metrics.hallucinatedPlaceCount).toBe(1); // temp_123
    expect(metrics.dayBoundaryViolations).toBe(1); // 25:00
    expect(metrics.unknownCostItemCount).toBe(1);
    expect(metrics.knownCost).toBe(2);
  });
});
