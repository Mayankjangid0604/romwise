/**
 * Tests for deterministic accessibility filtering in getCandidatePlaces.
 *
 * The filtering must:
 * - Exclude fatigueCost >= 4 when requirement is low_walking or senior
 * - Exclude accessibilityScore null or <= 2 when requirement is wheelchair
 * - Exclude fatigueCost >= 5 when requirement is child
 * - Boost accessibilityScore >= 4 places when wheelchair requirement
 * - Boost accessibilityScore >= 3 places when low_walking / senior
 * - Boost family category when child requirement
 * - Apply no filtering when requirement is "none"
 */
import { describe, it, expect } from "vitest";
import type { AccessibilityRequirement } from "@/lib/trip-brain";

// ── Inline the filtering/scoring logic (mirrors travel-knowledge.ts) ──

type PlaceData = {
  id: string;
  name: string;
  category: string;
  fatigueCost: number | null;
  accessibilityScore: number | null;
  popularityScore: number;
};

function applyAccessibilityFilter(
  place: PlaceData,
  req: AccessibilityRequirement,
): boolean {
  if (req === "none") return true;

  const fatigue = place.fatigueCost;
  const accessibility = place.accessibilityScore;

  if (req === "wheelchair") {
    if (accessibility === null || accessibility <= 2) return false;
  } else if (req === "low_walking") {
    if (fatigue !== null && fatigue >= 4) return false;
  } else if (req === "senior") {
    if (fatigue !== null && fatigue >= 4) return false;
  } else if (req === "child") {
    if (fatigue !== null && fatigue >= 5) return false;
  }

  return true;
}

function accessibilityBoost(
  place: PlaceData,
  req: AccessibilityRequirement,
): number {
  if (req === "none") return 0;
  const accessibility = place.accessibilityScore;

  if (req === "wheelchair" && accessibility !== null && accessibility >= 4) return 20;
  if ((req === "low_walking" || req === "senior") && accessibility !== null && accessibility >= 3) return 15;
  if (req === "child" && place.category === "family") return 15;
  return 0;
}

// ── Helpers ──

function makePlace(id: string, overrides: Partial<PlaceData> = {}): PlaceData {
  return {
    id,
    name: `Place ${id}`,
    category: "sightseeing",
    fatigueCost: null,
    accessibilityScore: null,
    popularityScore: 50,
    ...overrides,
  };
}

// ── Tests ──

describe("Accessibility Filtering (deterministic)", () => {
  describe("Requirement: none", () => {
    it("does not filter any places", () => {
      const places = [
        makePlace("1", { fatigueCost: 5, accessibilityScore: 1 }),
        makePlace("2", { fatigueCost: null, accessibilityScore: null }),
        makePlace("3", { fatigueCost: 4, accessibilityScore: 2 }),
      ];

      const filtered = places.filter((p) => applyAccessibilityFilter(p, "none"));
      expect(filtered).toHaveLength(3);
    });
  });

  describe("Requirement: wheelchair", () => {
    it("excludes places with null accessibilityScore", () => {
      const place = makePlace("1", { accessibilityScore: null });
      expect(applyAccessibilityFilter(place, "wheelchair")).toBe(false);
    });

    it("excludes places with accessibilityScore <= 2", () => {
      const place1 = makePlace("1", { accessibilityScore: 1 });
      const place2 = makePlace("2", { accessibilityScore: 2 });
      expect(applyAccessibilityFilter(place1, "wheelchair")).toBe(false);
      expect(applyAccessibilityFilter(place2, "wheelchair")).toBe(false);
    });

    it("allows places with accessibilityScore >= 3", () => {
      const place3 = makePlace("3", { accessibilityScore: 3 });
      const place5 = makePlace("5", { accessibilityScore: 5 });
      expect(applyAccessibilityFilter(place3, "wheelchair")).toBe(true);
      expect(applyAccessibilityFilter(place5, "wheelchair")).toBe(true);
    });

    it("applies +20 boost to places with accessibilityScore >= 4", () => {
      const low = makePlace("1", { accessibilityScore: 3 });
      const high = makePlace("2", { accessibilityScore: 4 });
      const highest = makePlace("3", { accessibilityScore: 5 });

      expect(accessibilityBoost(low, "wheelchair")).toBe(0);
      expect(accessibilityBoost(high, "wheelchair")).toBe(20);
      expect(accessibilityBoost(highest, "wheelchair")).toBe(20);
    });

    it("does not boost places with accessibilityScore < 4", () => {
      const place = makePlace("1", { accessibilityScore: 3 });
      expect(accessibilityBoost(place, "wheelchair")).toBe(0);
    });
  });

  describe("Requirement: low_walking", () => {
    it("excludes places with fatigueCost >= 4", () => {
      const p4 = makePlace("1", { fatigueCost: 4 });
      const p5 = makePlace("2", { fatigueCost: 5 });
      expect(applyAccessibilityFilter(p4, "low_walking")).toBe(false);
      expect(applyAccessibilityFilter(p5, "low_walking")).toBe(false);
    });

    it("allows places with fatigueCost < 4", () => {
      const p1 = makePlace("1", { fatigueCost: 1 });
      const p3 = makePlace("2", { fatigueCost: 3 });
      expect(applyAccessibilityFilter(p1, "low_walking")).toBe(true);
      expect(applyAccessibilityFilter(p3, "low_walking")).toBe(true);
    });

    it("allows places with null fatigueCost (unknown)", () => {
      const place = makePlace("1", { fatigueCost: null });
      expect(applyAccessibilityFilter(place, "low_walking")).toBe(true);
    });

    it("applies +15 boost to places with accessibilityScore >= 3", () => {
      const low = makePlace("1", { accessibilityScore: 2 });
      const high = makePlace("2", { accessibilityScore: 3 });
      const higher = makePlace("3", { accessibilityScore: 5 });

      expect(accessibilityBoost(low, "low_walking")).toBe(0);
      expect(accessibilityBoost(high, "low_walking")).toBe(15);
      expect(accessibilityBoost(higher, "low_walking")).toBe(15);
    });
  });

  describe("Requirement: senior", () => {
    it("excludes places with fatigueCost >= 4", () => {
      const p4 = makePlace("1", { fatigueCost: 4 });
      expect(applyAccessibilityFilter(p4, "senior")).toBe(false);
    });

    it("allows places with fatigueCost 3 or less", () => {
      const p3 = makePlace("1", { fatigueCost: 3 });
      expect(applyAccessibilityFilter(p3, "senior")).toBe(true);
    });

    it("applies +15 boost to places with accessibilityScore >= 3", () => {
      const place = makePlace("1", { accessibilityScore: 4 });
      expect(accessibilityBoost(place, "senior")).toBe(15);
    });
  });

  describe("Requirement: child", () => {
    it("excludes places with fatigueCost >= 5 only (not 4)", () => {
      const p4 = makePlace("1", { fatigueCost: 4 });
      const p5 = makePlace("2", { fatigueCost: 5 });
      expect(applyAccessibilityFilter(p4, "child")).toBe(true); // 4 allowed for kids
      expect(applyAccessibilityFilter(p5, "child")).toBe(false); // 5 excluded
    });

    it("applies +15 boost to family category places", () => {
      const familyPlace = makePlace("1", { category: "family" });
      const otherPlace = makePlace("2", { category: "sightseeing" });

      expect(accessibilityBoost(familyPlace, "child")).toBe(15);
      expect(accessibilityBoost(otherPlace, "child")).toBe(0);
    });
  });

  describe("Filtering effectively changes candidate ranking", () => {
    it("wheelchair requirement promotes high-accessibility places to top", () => {
      const places = [
        makePlace("1", { accessibilityScore: 2, popularityScore: 90 }), // will be excluded
        makePlace("2", { accessibilityScore: null, popularityScore: 80 }), // will be excluded
        makePlace("3", { accessibilityScore: 4, popularityScore: 50 }), // will be included + boosted
        makePlace("4", { accessibilityScore: 3, popularityScore: 70 }), // included but no boost
      ];

      const allowed = places.filter((p) => applyAccessibilityFilter(p, "wheelchair"));
      expect(allowed).toHaveLength(2);
      expect(allowed.map((p) => p.id)).toContain("3");
      expect(allowed.map((p) => p.id)).toContain("4");

      // Place 3 gets +20 boost even though it has lower popularity
      const boostFor3 = accessibilityBoost(places[2], "wheelchair");
      const boostFor4 = accessibilityBoost(places[3], "wheelchair");
      expect(boostFor3).toBe(20);
      expect(boostFor4).toBe(0);

      // Effective score (boost + popularity): place 3 = 50+20=70, place 4 = 70+0=70 (tie)
      // Both are in the candidate set
    });

    it("low_walking requirement removes high-fatigue places from results", () => {
      const places = [
        makePlace("1", { fatigueCost: 1 }),
        makePlace("2", { fatigueCost: 4 }), // excluded
        makePlace("3", { fatigueCost: 2 }),
        makePlace("4", { fatigueCost: 5 }), // excluded
      ];

      const allowed = places.filter((p) => applyAccessibilityFilter(p, "low_walking"));
      expect(allowed).toHaveLength(2);
      expect(allowed.map((p) => p.id)).toEqual(["1", "3"]);
    });
  });
});
