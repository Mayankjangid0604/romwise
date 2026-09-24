import { describe, it, expect } from "vitest";
import {
  suggestTransportModes,
  estimateTravelHours,
  inferRouteType,
  buildJourneyLegs,
  optimizeDestinationOrder,
  type JourneyStop,
} from "../journey";

describe("Journey Intelligence", () => {
  // ── Mode Heuristics ───────────────────────────────────────────────────────

  describe("suggestTransportModes", () => {
    it("suggests walk/auto for very short distances", () => {
      expect(suggestTransportModes(2)).toEqual(["walk", "auto"]);
    });

    it("suggests auto/bus for short distances", () => {
      expect(suggestTransportModes(15)).toEqual(["auto", "bus"]);
    });

    it("suggests bus/train/auto for medium distances", () => {
      expect(suggestTransportModes(100)).toEqual(["bus", "train", "auto"]);
    });

    it("suggests train/bus for long distances", () => {
      expect(suggestTransportModes(400)).toEqual(["train", "bus"]);
    });

    it("suggests flight/train for very long distances", () => {
      expect(suggestTransportModes(1000)).toEqual(["flight", "train"]);
    });
  });

  describe("estimateTravelHours", () => {
    it("calculates auto travel time", () => {
      // 100km at 35 km/h = ~2.86 hours
      const hours = estimateTravelHours(100, "auto");
      expect(hours).toBeCloseTo(2.86, 1);
    });

    it("includes ground time for flights", () => {
      // 1000km flight: 2h ground + 2h air = 4h
      const hours = estimateTravelHours(1000, "flight");
      expect(hours).toBeCloseTo(4, 0);
    });
  });

  // ── Route Type Inference ──────────────────────────────────────────────────

  describe("inferRouteType", () => {
    const origin: JourneyStop = { name: "Delhi", lat: 28.61, lng: 77.21 };
    const jaipur: JourneyStop = { name: "Jaipur", lat: 26.92, lng: 75.79 };
    const udaipur: JourneyStop = { name: "Udaipur", lat: 24.58, lng: 73.69 };

    it("infers ONE_WAY for single destination without round trip", () => {
      expect(inferRouteType(origin, [jaipur], false)).toBe("ONE_WAY");
    });

    it("infers ROUND_TRIP when flagged", () => {
      expect(inferRouteType(origin, [jaipur], true)).toBe("ROUND_TRIP");
    });

    it("infers MULTI_CITY for multiple destinations", () => {
      expect(inferRouteType(origin, [jaipur, udaipur], false)).toBe("MULTI_CITY");
    });

    it("infers MULTI_CITY even with round trip for multiple destinations", () => {
      expect(inferRouteType(origin, [jaipur, udaipur], true)).toBe("MULTI_CITY");
    });
  });

  // ── Journey Leg Construction ──────────────────────────────────────────────

  describe("buildJourneyLegs", () => {
    const delhi: JourneyStop = { name: "Delhi", lat: 28.6139, lng: 77.2090 };
    const jaipur: JourneyStop = { name: "Jaipur", lat: 26.9124, lng: 75.7873 };
    const udaipur: JourneyStop = { name: "Udaipur", lat: 24.5854, lng: 73.7125 };

    it("builds one-way journey", () => {
      const plan = buildJourneyLegs(delhi, [jaipur], false);
      expect(plan.routeType).toBe("ONE_WAY");
      expect(plan.legs).toHaveLength(1);
      expect(plan.legs[0].originName).toBe("Delhi");
      expect(plan.legs[0].destinationName).toBe("Jaipur");
      expect(plan.legs[0].distanceKm).toBeGreaterThan(200);
      expect(plan.legs[0].suggestedModes.length).toBeGreaterThan(0);
      expect(plan.legs[0].isReturn).toBe(false);
      expect(plan.returnToOrigin).toBe(false);
    });

    it("builds round trip with return leg", () => {
      const plan = buildJourneyLegs(delhi, [jaipur], true);
      expect(plan.routeType).toBe("ROUND_TRIP");
      expect(plan.legs).toHaveLength(2);
      expect(plan.legs[0].originName).toBe("Delhi");
      expect(plan.legs[0].destinationName).toBe("Jaipur");
      expect(plan.legs[0].isReturn).toBe(false);
      expect(plan.legs[1].originName).toBe("Jaipur");
      expect(plan.legs[1].destinationName).toBe("Delhi");
      expect(plan.legs[1].isReturn).toBe(true);
      expect(plan.returnToOrigin).toBe(true);
    });

    it("builds multi-city journey preserving order", () => {
      const plan = buildJourneyLegs(delhi, [jaipur, udaipur], false);
      expect(plan.routeType).toBe("MULTI_CITY");
      expect(plan.legs).toHaveLength(2);
      expect(plan.legs[0].originName).toBe("Delhi");
      expect(plan.legs[0].destinationName).toBe("Jaipur");
      expect(plan.legs[1].originName).toBe("Jaipur");
      expect(plan.legs[1].destinationName).toBe("Udaipur");
    });

    it("builds multi-city round trip", () => {
      const plan = buildJourneyLegs(delhi, [jaipur, udaipur], true);
      expect(plan.legs).toHaveLength(3);
      expect(plan.legs[2].originName).toBe("Udaipur");
      expect(plan.legs[2].destinationName).toBe("Delhi");
      expect(plan.legs[2].isReturn).toBe(true);
    });

    it("handles missing coordinates gracefully", () => {
      const noCoords: JourneyStop = { name: "Unknown", lat: null, lng: null };
      const plan = buildJourneyLegs(noCoords, [jaipur], false);
      expect(plan.legs).toHaveLength(1);
      expect(plan.legs[0].distanceKm).toBeNull();
      expect(plan.legs[0].estimateLabel).toBe("coordinates_missing");
      expect(plan.totalDistanceKm).toBeNull();
    });

    it("handles same origin and destination", () => {
      const plan = buildJourneyLegs(delhi, [delhi], false);
      expect(plan.legs).toHaveLength(1);
      expect(plan.legs[0].distanceKm).toBeCloseTo(0, 0);
    });

    it("handles no origin (destination only)", () => {
      const plan = buildJourneyLegs(null, [jaipur, udaipur], false);
      expect(plan.legs).toHaveLength(1);
      expect(plan.legs[0].originName).toBe("Jaipur");
      expect(plan.legs[0].destinationName).toBe("Udaipur");
      expect(plan.originName).toBeNull();
    });

    it("labels all estimates as approximate", () => {
      const plan = buildJourneyLegs(delhi, [jaipur], false);
      expect(plan.legs[0].estimateLabel).toBe("approximate");
    });
  });

  // ── Route Optimization ────────────────────────────────────────────────────

  describe("optimizeDestinationOrder", () => {
    const origin: JourneyStop = { name: "Delhi", lat: 28.6139, lng: 77.2090 };

    it("returns same order for 2 or fewer destinations", () => {
      const stops = [
        { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
        { name: "Udaipur", lat: 24.5854, lng: 73.7125 },
      ];
      const result = optimizeDestinationOrder(origin, stops);
      expect(result).toHaveLength(2);
    });

    it("optimizes a clearly suboptimal order", () => {
      // Delhi → Udaipur → Jaipur is suboptimal vs Delhi → Jaipur → Udaipur
      const stops: JourneyStop[] = [
        { name: "Udaipur", lat: 24.5854, lng: 73.7125 },
        { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
        { name: "Agra", lat: 27.1767, lng: 78.0081 },
      ];
      const result = optimizeDestinationOrder(origin, stops);
      expect(result).toHaveLength(3);
      // After optimization, Agra should come first (closest to Delhi)
      expect(result[0].name).toBe("Agra");
    });

    it("returns original order when coordinates are missing", () => {
      const stops: JourneyStop[] = [
        { name: "A", lat: null, lng: null },
        { name: "B", lat: 26.0, lng: 75.0 },
        { name: "C", lat: 24.0, lng: 73.0 },
      ];
      const result = optimizeDestinationOrder(origin, stops);
      expect(result[0].name).toBe("A");
    });
  });
});
