import { describe, it, expect } from "vitest";
import { getActivityDuration, buildDays } from "../scheduling";
import type { CandidatePlaceV2 } from "../types";
import type { GeographicCluster } from "../clustering";

const basePlace: CandidatePlaceV2 = {
  id: "test1", name: "Test", slug: "test", category: "history",
  lat: null, lng: null, typicalCostInr: null, durationMinutes: null,
  openingTime: null, closingTime: null, bestSeason: null, description: null,
  area: null, popularityScore: 50, hiddenGem: false, preferenceScore: 10,
  accessibilityScore: null, fatigueCost: null,
};

describe("Planner V2 Scheduling", () => {
  it("determines activity duration", () => {
    // Explicit duration
    expect(getActivityDuration({ ...basePlace, durationMinutes: 120 })).toBe(120);
    
    // Category fallback (short)
    expect(getActivityDuration({ ...basePlace, category: "cafe" })).toBe(45);
    
    // Category fallback (long)
    expect(getActivityDuration({ ...basePlace, category: "hike" })).toBe(180);
    
    // Standard baseline
    expect(getActivityDuration({ ...basePlace, category: "history" })).toBe(90);
  });

  it("builds days within limits and avoids ending before starting", () => {
    const places = [
      { ...basePlace, id: "p1", category: "history", durationMinutes: 60 },
      { ...basePlace, id: "p2", category: "culture", durationMinutes: 60 },
      { ...basePlace, id: "p3", category: "dining", durationMinutes: 60 },
      { ...basePlace, id: "p4", category: "shopping", durationMinutes: 60 },
      { ...basePlace, id: "p5", category: "relaxation", durationMinutes: 60 },
    ];
    
    const clusters: GeographicCluster[] = [{
      id: "c1", area: "test", center: null, places
    }];

    const days = buildDays(clusters, 1, "balanced", new Date());
    
    expect(days.length).toBe(1);
    
    const day = days[0];
    // Moderate pace = max 4 activities per day
    expect(day.items.length).toBeLessThanOrEqual(4);
    
    // Ensure no overlapping or backward times
    let lastEnd = 0;
    for (const item of day.items) {
      const [startH, startM] = item.startTime.split(":").map(Number);
      const [endH, endM] = item.endTime.split(":").map(Number);
      
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      
      expect(startTotal).toBeLessThan(endTotal);
      expect(startTotal).toBeGreaterThanOrEqual(lastEnd);
      lastEnd = endTotal;
    }
  });

  it("respects easy/relaxed pace by scheduling fewer activities", () => {
    const places = [
      { ...basePlace, id: "p1", durationMinutes: 60 },
      { ...basePlace, id: "p2", durationMinutes: 60 },
      { ...basePlace, id: "p3", durationMinutes: 60 },
      { ...basePlace, id: "p4", durationMinutes: 60 },
      { ...basePlace, id: "p5", durationMinutes: 60 },
    ];
    
    const clusters: GeographicCluster[] = [{ id: "c1", area: "test", center: null, places }];

    const balancedDays = buildDays(clusters, 1, "balanced", new Date());
    const easyDays = buildDays(clusters, 1, "easy", new Date());
    
    // Balanced usually schedules 4, easy schedules max 2 or 3
    expect(easyDays[0].items.length).toBeLessThan(balancedDays[0].items.length);
    expect(easyDays[0].items.length).toBeLessThanOrEqual(3);
  });

  it("skips places that are closed", () => {
    const places = [
      { ...basePlace, id: "p1", category: "history", durationMinutes: 60, openingTime: "10:00", closingTime: "11:00" },
    ];
    
    const clusters: GeographicCluster[] = [{
      id: "c1", area: "test", center: null, places
    }];

    const days = buildDays(clusters, 1, "balanced", new Date());
    
    // Day starts at 09:00. P1 opens at 10:00. Start time is shifted to 10:00. Duration 60 mins -> ends at 11:00. 
    // It should be exactly valid.
    expect(days[0].items.length).toBe(1);
    expect(days[0].items[0].startTime).toBe("10:00");
    expect(days[0].items[0].endTime).toBe("11:00");
  });
});
