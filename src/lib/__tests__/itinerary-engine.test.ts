import { describe, it, expect } from "vitest";
import {
  generateItinerary,
  type ItineraryInput,
  type Preference,
} from "../itinerary-engine";

function makeInput(overrides?: Partial<ItineraryInput>): ItineraryInput {
  return {
    destination: "Goa",
    startDate: new Date("2025-01-15"),
    endDate: new Date("2025-01-17"),
    budgetInr: 30000,
    paceLevel: "balanced",
    preferences: [],
    ...overrides,
  };
}

describe("generateItinerary", () => {
  it("produces one day per trip day (inclusive)", () => {
    const days = generateItinerary(makeInput());
    expect(days).toHaveLength(3);
    expect(days[0].dayNumber).toBe(1);
    expect(days[2].dayNumber).toBe(3);
  });

  it("assigns correct dates to each day", () => {
    const days = generateItinerary(makeInput());
    expect(days[0].date.toISOString().slice(0, 10)).toBe("2025-01-15");
    expect(days[1].date.toISOString().slice(0, 10)).toBe("2025-01-16");
    expect(days[2].date.toISOString().slice(0, 10)).toBe("2025-01-17");
  });

  it("easy pace produces fewer items than full pace", () => {
    const easy = generateItinerary(makeInput({ paceLevel: "easy" }));
    const full = generateItinerary(makeInput({ paceLevel: "full" }));

    const easyItemCount = easy.reduce((s, d) => s + d.items.length, 0);
    const fullItemCount = full.reduce((s, d) => s + d.items.length, 0);

    expect(easyItemCount).toBeLessThan(fullItemCount);
  });

  it("each item has valid time slots (HH:MM format)", () => {
    const days = generateItinerary(makeInput());
    const timeRegex = /^\d{2}:\d{2}$/;
    for (const day of days) {
      for (const item of day.items) {
        expect(item.startTime).toMatch(timeRegex);
        expect(item.endTime).toMatch(timeRegex);
        expect(item.startTime < item.endTime).toBe(true);
      }
    }
  });

  it("each item has a non-empty reasoning", () => {
    const days = generateItinerary(makeInput());
    for (const day of days) {
      for (const item of day.items) {
        expect(item.reasoning.length).toBeGreaterThan(10);
      }
    }
  });

  it("is deterministic — same input produces same output", () => {
    const a = generateItinerary(makeInput());
    const b = generateItinerary(makeInput());
    expect(a).toEqual(b);
  });

  it("different destinations produce different itineraries", () => {
    const goa = generateItinerary(makeInput({ destination: "Goa" }));
    const manali = generateItinerary(makeInput({ destination: "Manali" }));
    const goaTitles = goa.flatMap((d) => d.items.map((i) => i.title));
    const manaliTitles = manali.flatMap((d) => d.items.map((i) => i.title));
    expect(goaTitles).not.toEqual(manaliTitles);
  });

  it("respects must-have preferences by including that category", () => {
    const preferences: Preference[] = [
      { category: "adventure", priority: "must-have" },
    ];
    const days = generateItinerary(makeInput({ preferences }));
    const allCategories = days.flatMap((d) => d.items.map((i) => i.category));
    expect(allCategories).toContain("adventure");
  });

  it("never categories are excluded", () => {
    const preferences: Preference[] = [
      { category: "nightlife", priority: "never" },
    ];
    const days = generateItinerary(makeInput({ preferences }));
    const allCategories = days.flatMap((d) => d.items.map((i) => i.category));
    expect(allCategories).not.toContain("nightlife");
  });

  it("estimated costs are non-negative", () => {
    const days = generateItinerary(makeInput());
    for (const day of days) {
      for (const item of day.items) {
        expect(item.estimatedCostInr).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("handles a single-day trip", () => {
    const days = generateItinerary(
      makeInput({
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-03-01"),
      }),
    );
    expect(days).toHaveLength(1);
    expect(days[0].items.length).toBeGreaterThan(0);
  });

  it("items have valid categories", () => {
    const validCategories = [
      "dining",
      "sightseeing",
      "adventure",
      "culture",
      "shopping",
      "relaxation",
      "nightlife",
      "nature",
    ];
    const days = generateItinerary(makeInput());
    for (const day of days) {
      for (const item of day.items) {
        expect(validCategories).toContain(item.category);
      }
    }
  });

  it("each day has exactly the number of items matching its pace level", () => {
    const slotCounts = { easy: 4, balanced: 6, full: 8 } as const;
    for (const pace of ["easy", "balanced", "full"] as const) {
      const days = generateItinerary(makeInput({ paceLevel: pace }));
      for (const day of days) {
        expect(day.items.length).toBe(slotCounts[pace]);
      }
    }
  });
});
