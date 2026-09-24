import { describe, it, expect } from "vitest";
import { computeDataQualityScore, computeBudgetScore, scoreCandidates } from "../scoring";
import type { CandidatePlaceV2 } from "../types";

const basePlace: CandidatePlaceV2 = {
  id: "test1",
  name: "Test",
  slug: "test",
  category: "history",
  lat: null,
  lng: null,
  typicalCostInr: null,
  durationMinutes: null,
  openingTime: null,
  closingTime: null,
  bestSeason: null,
  description: null,
  area: null,
  popularityScore: 50,
  hiddenGem: false,
  preferenceScore: 10,
  accessibilityScore: null,
  fatigueCost: null,
};

describe("Planner V2 Scoring", () => {
  it("computes data quality accurately", () => {
    expect(computeDataQualityScore(basePlace)).toBe(0);
    
    expect(computeDataQualityScore({ ...basePlace, lat: 1, lng: 1 })).toBe(20);
    expect(computeDataQualityScore({ ...basePlace, durationMinutes: 60 })).toBe(10);
    expect(computeDataQualityScore({ ...basePlace, typicalCostInr: 100 })).toBe(10);
    
    expect(computeDataQualityScore({ 
      ...basePlace, 
      lat: 1, lng: 1, 
      durationMinutes: 60, 
      typicalCostInr: 100, 
      openingTime: "09:00", closingTime: "17:00",
      area: "Downtown"
    })).toBe(60);
  });

  it("computes budget correctly", () => {
    // Unknown cost = 50
    expect(computeBudgetScore(basePlace, 1000)).toBe(50);
    
    // Free cost = 100
    expect(computeBudgetScore({ ...basePlace, typicalCostInr: 0 }, 1000)).toBe(100);
    
    // Within budget (200 / 1000 = 0.2 ratio -> 90)
    expect(computeBudgetScore({ ...basePlace, typicalCostInr: 200 }, 1000)).toBe(90);
    
    // Exactly budget (1000 / 1000 = 1.0 ratio -> 50)
    expect(computeBudgetScore({ ...basePlace, typicalCostInr: 1000 }, 1000)).toBe(50);
    
    // Over budget (1500 / 1000 = 1.5 ratio -> 25)
    expect(computeBudgetScore({ ...basePlace, typicalCostInr: 1500 }, 1000)).toBe(25);
    
    // Way over budget (3000 / 1000 = 3.0 ratio -> 0)
    expect(computeBudgetScore({ ...basePlace, typicalCostInr: 3000 }, 1000)).toBe(0);
  });
  
  it("scores candidates avoiding NaN", () => {
    const scored = scoreCandidates([basePlace], 1000, "none");
    expect(scored[0].v2Score?.total).not.toBeNaN();
    expect(scored[0].v2Score?.total).toBe(90); // 15 + 50 + 0 + 0 + 25 - 0 = 90
  });
});
