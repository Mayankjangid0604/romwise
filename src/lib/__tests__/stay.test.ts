import { describe, it, expect } from "vitest";
import { rankStays, type StayCandidate, type StayRankingInput } from "../stay";

describe("rankStays", () => {
  const defaultInput: StayRankingInput = {
    nights: 3,
    remainingBudgetInr: 10000,
    stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
  };

  const SAMPLE_HOTEL_CANDIDATES: StayCandidate[] = [
    { id: "1", name: "Budget Inn Express", costPerNightInr: 1200, lat: 15.4950, lng: 73.8300 },
    { id: "2", name: "Coastal View Hostel", costPerNightInr: 800, lat: 15.4880, lng: 73.8250 },
    { id: "3", name: "Traveler's Rest Lodge", costPerNightInr: 1800, lat: 15.4920, lng: 73.8320 },
    { id: "4", name: "Heritage Comfort Hotel", costPerNightInr: 3500, lat: 15.4900, lng: 73.8280 },
    { id: "5", name: "Grand Palace Resort", costPerNightInr: 6000, lat: 15.4870, lng: 73.8350 },
    { id: "6", name: "Backpacker's Bunk", costPerNightInr: 500, lat: 15.4960, lng: 73.8220 },
    { id: "7", name: "Sunrise Boutique Stay", costPerNightInr: null, lat: 15.4940, lng: 73.8310 }, // Test null cost
  ];

  it("returns all candidates", () => {
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    expect(ranked.length).toBe(SAMPLE_HOTEL_CANDIDATES.length);
  });

  it("sorts hotels by overallScore descending", () => {
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].overallScore).toBeGreaterThanOrEqual(
        ranked[i].overallScore,
      );
    }
  });

  it("computes totalCostInr as costPerNight * nights", () => {
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    for (const hotel of ranked) {
      if (hotel.costPerNightInr !== null) {
        expect(hotel.totalCostInr).toBe(hotel.costPerNightInr * defaultInput.nights);
      } else {
        expect(hotel.totalCostInr).toBeNull();
      }
    }
  });

  it("gives higher budget fit to cheaper hotels when budget is tight", () => {
    const input: StayRankingInput = {
      nights: 3,
      remainingBudgetInr: 3000,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, input);
    const cheapest = ranked.find((h) => h.name === "Backpacker's Bunk")!;
    const priciest = ranked.find((h) => h.name === "Grand Palace Resort")!;

    expect(cheapest.budgetFitScore).toBeGreaterThan(priciest.budgetFitScore);
  });

  it("assigns a neutral score of 50 to hotels with unknown costs", () => {
    const input: StayRankingInput = {
      nights: 3,
      remainingBudgetInr: 3000,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, input);
    const unknownCostHotel = ranked.find((h) => h.name === "Sunrise Boutique Stay")!;
    expect(unknownCostHotel.budgetFitScore).toBe(50);
  });

  it("gives higher distance score to hotels closer to stops", () => {
    const input: StayRankingInput = {
      nights: 1,
      remainingBudgetInr: 100000,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, input);

    const closest = ranked.reduce((a, b) =>
      a.avgDistanceToStopsKm < b.avgDistanceToStopsKm ? a : b,
    );
    const farthest = ranked.reduce((a, b) =>
      a.avgDistanceToStopsKm > b.avgDistanceToStopsKm ? a : b,
    );

    expect(closest.distanceScore).toBeGreaterThanOrEqual(farthest.distanceScore);
  });

  it("handles zero remaining budget gracefully", () => {
    const input: StayRankingInput = {
      nights: 2,
      remainingBudgetInr: 0,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, input);

    for (const hotel of ranked) {
      if (hotel.costPerNightInr !== null) {
        expect(hotel.budgetFitScore).toBe(0);
      }
      expect(hotel.overallScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles empty stop coordinates", () => {
    const input: StayRankingInput = {
      nights: 2,
      remainingBudgetInr: 10000,
      stopCoordinates: [],
    };
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, input);

    for (const hotel of ranked) {
      expect(hotel.avgDistanceToStopsKm).toBe(0);
      expect(hotel.distanceScore).toBe(100);
    }
  });

  it("overallScore is 50% budget + 50% distance", () => {
    const ranked = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    for (const hotel of ranked) {
      expect(hotel.overallScore).toBe(
        Math.round(hotel.budgetFitScore * 0.5 + hotel.distanceScore * 0.5),
      );
    }
  });

  it("is deterministic", () => {
    const a = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    const b = rankStays(SAMPLE_HOTEL_CANDIDATES, defaultInput);
    expect(a).toEqual(b);
  });
});
