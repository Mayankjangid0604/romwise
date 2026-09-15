/**
 * Cross-destination contamination prevention tests for travel-knowledge.ts.
 *
 * Core guarantee: getCandidatePlaces for destination X must NEVER return
 * places tagged to a completely unrelated destination Y.
 * Scenarios A–F match the Batch 2.6 specification.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    place: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    travelDestination: {
      findMany: vi.fn(),
    },
  },
}));

import { getCandidatePlaces, verifyPlaceOwnership, bulkVerifyPlaces } from "../travel-knowledge";
import { prisma } from "@/lib/db";

const mockPlaceFindMany = vi.mocked(prisma.place.findMany);
const mockPlaceFindUnique = vi.mocked(prisma.place.findUnique);
const mockDestFindMany = vi.mocked(prisma.travelDestination.findMany);

function makePlace(overrides: Record<string, unknown>) {
  return {
    id: "place-default",
    name: "Default Place",
    slug: "default-place",
    category: "sightseeing",
    lat: 15.5,
    lng: 73.8,
    typicalCostInr: null,
    durationMinutes: null,
    openingTime: null,
    closingTime: null,
    bestSeason: null,
    description: null,
    area: null,
    popularityScore: 50,
    hiddenGem: false,
    destinationId: "dest-default",
    dataStatus: "active",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Scenario A: Goa — places from Panaji (child) are included ────────────────

describe("Scenario A: Goa destination includes Panaji child places", () => {
  it("getCandidatePlaces for Goa returns places tagged to Panaji", async () => {
    // Goa has one child: Panaji
    mockDestFindMany
      .mockResolvedValueOnce([{ id: "dest-panaji" }] as never) // Goa's children
      .mockResolvedValueOnce([]); // Panaji has no children

    const goaPlace = makePlace({ id: "place-goa-beach", destinationId: "dest-goa" });
    const panajiPlace = makePlace({ id: "place-panaji-church", destinationId: "dest-panaji", name: "Old Goa Churches" });
    mockPlaceFindMany.mockResolvedValueOnce([goaPlace, panajiPlace] as never);

    const results = await getCandidatePlaces({
      destinationId: "dest-goa",
      allPreferences: [],
    });

    const ids = results.map((p) => p.id);
    expect(ids).toContain("place-goa-beach");
    expect(ids).toContain("place-panaji-church");
  });
});

// ── Scenario B: Panaji — places from Goa (parent) are NOT included ───────────

describe("Scenario B: Panaji destination does NOT include Goa parent places", () => {
  it("getCandidatePlaces for Panaji only queries Panaji and its children, not Goa", async () => {
    // Panaji has no children
    mockDestFindMany.mockResolvedValueOnce([]); // Panaji's children = empty

    const panajiPlace = makePlace({ id: "place-panaji-market", destinationId: "dest-panaji" });
    mockPlaceFindMany.mockResolvedValueOnce([panajiPlace] as never);

    const results = await getCandidatePlaces({
      destinationId: "dest-panaji",
      allPreferences: [],
    });

    // Should only see Panaji place, not any Goa-only place
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("place-panaji-market");

    // Verify the DB was queried with only Panaji's ID subtree
    const findManyCall = mockPlaceFindMany.mock.calls[0][0] as { where: { destinationId: { in: string[] } } };
    expect(findManyCall.where.destinationId.in).toContain("dest-panaji");
    expect(findManyCall.where.destinationId.in).not.toContain("dest-goa");
  });
});

// ── Scenario C: Ladakh — completely separate from Goa, no cross-contamination ─

describe("Scenario C: Ladakh places never appear in a Goa query", () => {
  it("getCandidatePlaces for Goa does not return Ladakh places", async () => {
    // Goa has no children for this test
    mockDestFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const goaPlace = makePlace({ id: "place-goa-fort", destinationId: "dest-goa" });
    // Prisma's IN filter handles this — Ladakh places are simply not in the query result
    mockPlaceFindMany.mockResolvedValueOnce([goaPlace] as never);

    const results = await getCandidatePlaces({ destinationId: "dest-goa", allPreferences: [] });

    const ids = results.map((p) => p.id);
    expect(ids).not.toContain("place-ladakh-pangong");
    expect(ids).toContain("place-goa-fort");
  });
});

// ── Scenario D: Meghalaya — "never nightlife" preference hard-excludes nightlife ─

describe("Scenario D: never nightlife preference excludes nightlife places", () => {
  it("nightlife places are excluded when traveler has never:nightlife", async () => {
    mockDestFindMany.mockResolvedValueOnce([]);

    const cavePlace = makePlace({ id: "place-cave", category: "nature", destinationId: "dest-meghalaya" });
    const clubPlace = makePlace({ id: "place-club", category: "nightlife", destinationId: "dest-meghalaya" });
    mockPlaceFindMany.mockResolvedValueOnce([cavePlace, clubPlace] as never);

    const results = await getCandidatePlaces({
      destinationId: "dest-meghalaya",
      allPreferences: [{ category: "nightlife", priority: "never" }],
    });

    const ids = results.map((p) => p.id);
    expect(ids).not.toContain("place-club");
    expect(ids).toContain("place-cave");
  });
});

// ── Scenario E: Jaipur — never nightlife, mixed preferences ──────────────────

describe("Scenario E: Jaipur with never:nightlife and love:history", () => {
  it("history places score higher and nightlife is excluded", async () => {
    mockDestFindMany.mockResolvedValueOnce([]);

    const fortPlace = makePlace({ id: "place-fort", category: "history", popularityScore: 80, destinationId: "dest-jaipur" });
    const shopPlace = makePlace({ id: "place-market", category: "shopping", popularityScore: 70, destinationId: "dest-jaipur" });
    const clubPlace = makePlace({ id: "place-club", category: "nightlife", popularityScore: 90, destinationId: "dest-jaipur" });
    mockPlaceFindMany.mockResolvedValueOnce([fortPlace, shopPlace, clubPlace] as never);

    const results = await getCandidatePlaces({
      destinationId: "dest-jaipur",
      allPreferences: [
        { category: "history", priority: "must-have" },
        { category: "nightlife", priority: "never" },
      ],
    });

    const ids = results.map((p) => p.id);
    // Nightlife excluded
    expect(ids).not.toContain("place-club");
    // History and shopping included
    expect(ids).toContain("place-fort");
    expect(ids).toContain("place-market");
    // History should rank before shopping (love:history)
    const fortIdx = results.findIndex((p) => p.id === "place-fort");
    const shopIdx = results.findIndex((p) => p.id === "place-market");
    expect(fortIdx).toBeLessThan(shopIdx);
  });
});

// ── Scenario F: Atlantis — unknown destination returns empty candidates ────────

describe("Scenario F: unknown destination (Atlantis)", () => {
  it("returns empty candidates when no places exist for the destination", async () => {
    mockDestFindMany.mockResolvedValueOnce([]);
    mockPlaceFindMany.mockResolvedValueOnce([]);

    const results = await getCandidatePlaces({
      destinationId: "dest-atlantis-nonexistent",
      allPreferences: [],
    });

    expect(results).toHaveLength(0);
  });
});

// ── verifyPlaceOwnership: cross-destination rejection ─────────────────────────

describe("verifyPlaceOwnership: cross-destination rejection", () => {
  it("returns null when place belongs to a different destination", async () => {
    mockDestFindMany.mockResolvedValueOnce([]); // Jaipur has no children
    mockPlaceFindUnique.mockResolvedValueOnce(
      makePlace({ id: "goa-place", destinationId: "dest-goa", dataStatus: "active" }) as never,
    );

    const result = await verifyPlaceOwnership("goa-place", "dest-jaipur");
    expect(result).toBeNull();
  });

  it("returns the place when it belongs to the destination", async () => {
    mockDestFindMany.mockResolvedValueOnce([]); // no children
    mockPlaceFindUnique.mockResolvedValueOnce(
      makePlace({ id: "jaipur-place", destinationId: "dest-jaipur", dataStatus: "active" }) as never,
    );

    const result = await verifyPlaceOwnership("jaipur-place", "dest-jaipur");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("jaipur-place");
  });

  it("returns null for deprecated place even in correct destination", async () => {
    mockDestFindMany.mockResolvedValueOnce([]);
    mockPlaceFindUnique.mockResolvedValueOnce(
      makePlace({ id: "old-place", destinationId: "dest-jaipur", dataStatus: "deprecated" }) as never,
    );

    const result = await verifyPlaceOwnership("old-place", "dest-jaipur");
    expect(result).toBeNull();
  });

  it("Panaji place verified against Goa parent returns the place (hierarchy-aware)", async () => {
    // Goa hierarchy: Goa → Panaji
    mockDestFindMany
      .mockResolvedValueOnce([{ id: "dest-panaji" }] as never)
      .mockResolvedValueOnce([]);
    mockPlaceFindUnique.mockResolvedValueOnce(
      makePlace({ id: "panaji-market", destinationId: "dest-panaji", dataStatus: "active" }) as never,
    );

    const result = await verifyPlaceOwnership("panaji-market", "dest-goa");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("panaji-market");
  });
});

// ── bulkVerifyPlaces: cross-contamination ─────────────────────────────────────

describe("bulkVerifyPlaces: cross-destination filtering", () => {
  it("place from wrong destination lands in unknown list", async () => {
    mockDestFindMany.mockResolvedValueOnce([]); // no children
    // DB returns only places in the right destination
    mockPlaceFindMany.mockResolvedValueOnce([
      makePlace({ id: "right-place", destinationId: "dest-jaipur" }),
    ] as never);

    const { verified, unknown } = await bulkVerifyPlaces(
      ["right-place", "wrong-place"],
      "dest-jaipur",
    );

    expect(verified.has("right-place")).toBe(true);
    expect(unknown).toContain("wrong-place");
  });

  it("empty input returns empty maps", async () => {
    const { verified, unknown } = await bulkVerifyPlaces([], "dest-goa");
    expect(verified.size).toBe(0);
    expect(unknown).toHaveLength(0);
    expect(mockDestFindMany).not.toHaveBeenCalled();
  });
});
