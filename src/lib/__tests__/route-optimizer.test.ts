import { describe, it, expect } from "vitest";
import {
  optimizeRoute,
  haversineKm,
  syntheticCoordinates,
  type RouteStop,
} from "../route-optimizer";

function makeStop(
  id: string,
  title: string,
  lat: number,
  lng: number,
  order: number,
): RouteStop {
  return {
    id,
    title,
    category: "sightseeing",
    startTime: `${(8 + order).toString().padStart(2, "0")}:00`,
    endTime: `${(9 + order).toString().padStart(2, "0")}:00`,
    order,
    lat,
    lng,
  };
}

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(15.5, 73.8, 15.5, 73.8)).toBe(0);
  });

  it("returns reasonable distance for nearby points", () => {
    const d = haversineKm(15.49, 73.82, 15.50, 73.83);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5);
  });

  it("returns larger distance for far apart points", () => {
    const near = haversineKm(15.49, 73.82, 15.50, 73.83);
    const far = haversineKm(15.49, 73.82, 15.60, 73.90);
    expect(far).toBeGreaterThan(near);
  });
});

describe("optimizeRoute", () => {
  it("returns empty result for no stops", () => {
    const result = optimizeRoute([]);
    expect(result.originalOrder).toHaveLength(0);
    expect(result.optimizedOrder).toHaveLength(0);
    expect(result.distanceSavedKm).toBe(0);
  });

  it("returns same order for single stop", () => {
    const stops = [makeStop("1", "Beach", 15.5, 73.8, 1)];
    const result = optimizeRoute(stops);
    expect(result.optimizedOrder).toHaveLength(1);
    expect(result.originalTotalKm).toBe(0);
  });

  it("returns same order for two stops", () => {
    const stops = [
      makeStop("1", "Beach", 15.5, 73.8, 1),
      makeStop("2", "Temple", 15.52, 73.82, 2),
    ];
    const result = optimizeRoute(stops);
    expect(result.optimizedOrder).toHaveLength(2);
    expect(result.originalTotalKm).toBeGreaterThan(0);
  });

  it("detects backtracking in a zigzag route", () => {
    const stops = [
      makeStop("1", "North point", 15.60, 73.80, 1),
      makeStop("2", "South point", 15.40, 73.80, 2),
      makeStop("3", "North again", 15.58, 73.81, 3),
    ];
    const result = optimizeRoute(stops);
    expect(result.backtracking.detected).toBe(true);
    expect(result.backtracking.segments.length).toBeGreaterThan(0);
  });

  it("does not detect backtracking in a linear route", () => {
    const stops = [
      makeStop("1", "A", 15.50, 73.80, 1),
      makeStop("2", "B", 15.51, 73.81, 2),
      makeStop("3", "C", 15.52, 73.82, 3),
    ];
    const result = optimizeRoute(stops);
    expect(result.backtracking.detected).toBe(false);
  });

  it("optimized route is no longer than original", () => {
    const stops = [
      makeStop("1", "Start", 15.50, 73.80, 1),
      makeStop("2", "Far away", 15.60, 73.90, 2),
      makeStop("3", "Near start", 15.51, 73.81, 3),
      makeStop("4", "Near far", 15.59, 73.89, 4),
    ];
    const result = optimizeRoute(stops);
    expect(result.optimizedTotalKm).toBeLessThanOrEqual(
      result.originalTotalKm,
    );
  });

  it("produces correct leg count", () => {
    const stops = [
      makeStop("1", "A", 15.50, 73.80, 1),
      makeStop("2", "B", 15.51, 73.81, 2),
      makeStop("3", "C", 15.52, 73.82, 3),
      makeStop("4", "D", 15.53, 73.83, 4),
    ];
    const result = optimizeRoute(stops);
    expect(result.originalLegs).toHaveLength(3);
    expect(result.optimizedLegs).toHaveLength(3);
  });

  it("each leg has positive or zero distance", () => {
    const stops = [
      makeStop("1", "A", 15.50, 73.80, 1),
      makeStop("2", "B", 15.55, 73.85, 2),
      makeStop("3", "C", 15.48, 73.78, 3),
    ];
    const result = optimizeRoute(stops);
    for (const leg of result.optimizedLegs) {
      expect(leg.distanceKm).toBeGreaterThanOrEqual(0);
      expect(leg.estimatedMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("time saved is consistent with distance saved", () => {
    const stops = [
      makeStop("1", "Start", 15.50, 73.80, 1),
      makeStop("2", "Far away", 15.60, 73.90, 2),
      makeStop("3", "Near start", 15.51, 73.81, 3),
      makeStop("4", "Near far", 15.59, 73.89, 4),
    ];
    const result = optimizeRoute(stops);
    if (result.distanceSavedKm > 0) {
      expect(result.timeSavedMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("distance saved equals original minus optimized", () => {
    const stops = [
      makeStop("1", "A", 15.50, 73.80, 1),
      makeStop("2", "B", 15.55, 73.85, 2),
      makeStop("3", "C", 15.48, 73.78, 3),
    ];
    const result = optimizeRoute(stops);
    expect(result.distanceSavedKm).toBeCloseTo(
      result.originalTotalKm - result.optimizedTotalKm,
      1,
    );
  });
});
