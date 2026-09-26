import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaySuggestions } from "../stay-suggestions";
import { prisma } from "@/lib/db";
import { getTripStayRecommendations } from "@/lib/stay";

vi.mock("@/lib/db", () => ({
  prisma: {
    itineraryItem: { findMany: vi.fn() },
    place: { findMany: vi.fn(async () => []) },
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const jaipur = { id: "jaipur-id", slug: "jaipur", name: "Jaipur", lat: 26.915, lng: 75.82, destinationType: "city" };
const trip = {
  id: "t1",
  budgetInr: 40000,
  startDate: new Date("2026-10-16T00:00:00Z"),
  endDate: new Date("2026-10-18T00:00:00Z"),
  tripType: "MULTI_DAY",
  destinationRef: jaipur,
};

describe("overview hotel suggestions", () => {
  beforeEach(() => {
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([
      { estimatedCostInr: 500, place: { lat: 26.9239, lng: 75.8267 } },
      { estimatedCostInr: 200, place: { lat: 26.9855, lng: 75.8513 } },
    ] as any);
  });

  it("shows the Stay tab's top 3 with name, rating and price, labelled as sample data", async () => {
    const { ranked } = await getTripStayRecommendations(trip);
    const html = renderToStaticMarkup(await StaySuggestions({ trip, selectedRef: null }));

    for (const hotel of ranked.slice(0, 3)) {
      expect(html).toContain(hotel.name.replace(/'/g, "&#x27;"));
      expect(html).toContain(hotel.rating!.toFixed(1));
      expect(html).toContain(`₹${hotel.costPerNightInr!.toLocaleString("en-IN")}`);
    }
    expect(html).not.toContain(ranked[3].name.replace(/'/g, "&#x27;"));
    expect(html).toContain("Sample data");
    expect(html).toContain(`See all ${ranked.length} stays`);
    expect(html).toContain('href="/trips/t1/stay"');
  });

  it("skips the hotel that's already selected", async () => {
    const { ranked } = await getTripStayRecommendations(trip);
    const html = renderToStaticMarkup(await StaySuggestions({ trip, selectedRef: ranked[0].id }));
    expect(html).not.toContain(`>${ranked[0].name.replace(/'/g, "&#x27;")}<`);
    expect(html).toContain("Other suggested stays");
    expect(html).toContain(ranked[3].name.replace(/'/g, "&#x27;"));
  });

  it("renders nothing when the trip isn't linked to a destination", async () => {
    expect(await StaySuggestions({ trip: { ...trip, destinationRef: null }, selectedRef: null })).toBeNull();
  });

  it("ranks against the itinerary's stops and the budget left after activities", async () => {
    const { nights, remainingBudgetInr, ranked } = await getTripStayRecommendations(trip);
    expect(nights).toBe(2); // Oct 16–18
    expect(remainingBudgetInr).toBe(40000 - 700);
    expect(ranked.every((h) => h.avgDistanceToStopsKm > 0)).toBe(true);
  });
});
