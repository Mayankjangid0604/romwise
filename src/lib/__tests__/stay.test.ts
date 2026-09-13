import { describe, it, expect } from "vitest";
import { rankHotels, SAMPLE_HOTELS, type StayRankingInput } from "../stay";

describe("rankHotels", () => {
  const defaultInput: StayRankingInput = {
    nights: 3,
    remainingBudgetInr: 10000,
    stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
  };

  it("returns all sample hotels", () => {
    const ranked = rankHotels(defaultInput);
    expect(ranked.length).toBe(SAMPLE_HOTELS.length);
  });

  it("sorts hotels by overallScore descending", () => {
    const ranked = rankHotels(defaultInput);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].overallScore).toBeGreaterThanOrEqual(
        ranked[i].overallScore,
      );
    }
  });

  it("computes totalCostInr as costPerNight * nights", () => {
    const ranked = rankHotels(defaultInput);
    for (const hotel of ranked) {
      expect(hotel.totalCostInr).toBe(
        hotel.costPerNightInr * defaultInput.nights,
      );
    }
  });

  it("gives higher budget fit to cheaper hotels when budget is tight", () => {
    const input: StayRankingInput = {
      nights: 3,
      remainingBudgetInr: 3000,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankHotels(input);
    const cheapest = ranked.find((h) => h.name === "Backpacker's Bunk")!;
    const priciest = ranked.find((h) => h.name === "Grand Palace Resort")!;

    expect(cheapest.budgetFitScore).toBeGreaterThan(priciest.budgetFitScore);
  });

  it("gives higher distance score to hotels closer to stops", () => {
    const input: StayRankingInput = {
      nights: 1,
      remainingBudgetInr: 100000,
      stopCoordinates: [{ lat: 15.493, lng: 73.83 }],
    };
    const ranked = rankHotels(input);

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
    const ranked = rankHotels(input);

    for (const hotel of ranked) {
      expect(hotel.budgetFitScore).toBe(0);
      expect(hotel.overallScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles empty stop coordinates", () => {
    const input: StayRankingInput = {
      nights: 2,
      remainingBudgetInr: 10000,
      stopCoordinates: [],
    };
    const ranked = rankHotels(input);

    for (const hotel of ranked) {
      expect(hotel.avgDistanceToStopsKm).toBe(0);
      expect(hotel.distanceScore).toBe(100);
    }
  });

  it("overallScore is 50% budget + 50% distance", () => {
    const ranked = rankHotels(defaultInput);
    for (const hotel of ranked) {
      expect(hotel.overallScore).toBe(
        Math.round(hotel.budgetFitScore * 0.5 + hotel.distanceScore * 0.5),
      );
    }
  });

  it("is deterministic", () => {
    const a = rankHotels(defaultInput);
    const b = rankHotels(defaultInput);
    expect(a).toEqual(b);
  });
});
