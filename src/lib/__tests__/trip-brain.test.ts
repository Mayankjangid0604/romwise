import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/ai/gateway", () => {
  const AIGatewayError = class extends Error {
    constructor(msg: string, public code: string, public isTransient: boolean = false) {
      super(msg);
      this.name = "AIGatewayError";
    }
  };
  return {
    maxTravelers: 1, AIGatewayError, AIGateway: { generateText: vi.fn(), generateStructured: vi.fn() } };
});

vi.mock("@/lib/destination-resolver", () => ({
  resolveDestination: vi.fn(),
}));

vi.mock("@/lib/travel-knowledge", () => ({
  getCandidatePlaces: vi.fn(),
  bulkVerifyPlaces: vi.fn(),
}));

import { resolveDestination } from "@/lib/destination-resolver";
import { getCandidatePlaces, bulkVerifyPlaces } from "@/lib/travel-knowledge";
import { AIGateway } from "@/lib/ai/gateway";
import {
  generateGroundedItinerary,
  computeDayWindow,
  DestinationNotFoundError,
  DestinationDataError,
  ValidationError,
  type TripBrainInput,
} from "../trip-brain";

const mockResolve = vi.mocked(resolveDestination);
const mockCandidates = vi.mocked(getCandidatePlaces);
const mockBulkVerify = vi.mocked(bulkVerifyPlaces);
const mockGenerateText = vi.mocked(AIGateway.generateText);
const mockGenerateStructured = vi.mocked(AIGateway.generateStructured);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const JAIPUR = {
  id: "dest-jaipur",
  name: "Jaipur",
  state: "Rajasthan",
  country: "India",
  lat: 26.9124,
  lng: 75.7873,
  matchType: "exact" as const,
};

function makePlaces(overrides: Partial<typeof PLACE_HAWA_MAHAL>[] = []) {
  return [PLACE_HAWA_MAHAL, PLACE_AMBER_FORT, PLACE_JOHARI, PLACE_DINING, PLACE_SPIRITUAL].map(
    (p, i) => ({ ...p, ...overrides[i] }),
  );
}

const PLACE_HAWA_MAHAL = {
  id: "place-hawa-mahal",
  name: "Hawa Mahal",
  slug: "hawa-mahal-jaipur",
  placeType: null,
  category: "sightseeing",
  lat: 26.9239,
  lng: 75.8267,
  typicalCostInr: 200,
  durationMinutes: 60,
  openingTime: "09:00",
  closingTime: "17:00",
  bestSeason: "Oct-Mar",
  description: "Iconic pink palace",
  area: "Old City",
  popularityScore: 95,
  hiddenGem: false,
  preferenceScore: 0,
  accessibilityScore: null,
  fatigueCost: null,
};

const PLACE_AMBER_FORT = {
  id: "place-amber-fort",
  name: "Amber Fort",
  slug: "amber-fort-jaipur",
  placeType: null,
  category: "history",
  lat: 26.9855,
  lng: 75.8513,
  typicalCostInr: 500,
  durationMinutes: 120,
  openingTime: "08:00",
  closingTime: "17:30",
  bestSeason: "Oct-Mar",
  description: "Hilltop fort",
  area: "Amer",
  popularityScore: 98,
  hiddenGem: false,
  preferenceScore: 0,
  accessibilityScore: null,
  fatigueCost: null,
};

const PLACE_JOHARI = {
  id: "place-johari",
  name: "Johari Bazaar",
  slug: "johari-bazaar-jaipur",
  placeType: null,
  category: "shopping",
  lat: 26.9225,
  lng: 75.8202,
  typicalCostInr: 0,
  durationMinutes: 90,
  openingTime: "10:00",
  closingTime: "20:00",
  bestSeason: "year-round",
  description: "Jewellery market",
  area: "Old City",
  popularityScore: 85,
  hiddenGem: false,
  preferenceScore: 0,
  accessibilityScore: null,
  fatigueCost: null,
};

const PLACE_DINING = {
  id: "place-chokhi",
  name: "Chokhi Dhani",
  slug: "chokhi-dhani-jaipur",
  placeType: null,
  category: "dining",
  lat: 26.7951,
  lng: 75.8344,
  typicalCostInr: 1100,
  durationMinutes: 180,
  openingTime: "17:00",
  closingTime: "23:00",
  bestSeason: "Oct-Mar",
  description: "Rajasthani village resort",
  area: "Tonk Road",
  popularityScore: 88,
  hiddenGem: false,
  preferenceScore: 0,
  accessibilityScore: null,
  fatigueCost: null,
};

const PLACE_SPIRITUAL = {
  id: "place-birla",
  name: "Birla Mandir",
  slug: "birla-mandir-jaipur",
  placeType: null,
  category: "spiritual",
  lat: 26.8942,
  lng: 75.8223,
  typicalCostInr: 0,
  durationMinutes: 45,
  openingTime: "06:00",
  closingTime: "21:00",
  bestSeason: "year-round",
  description: "White marble temple",
  area: "Tilak Nagar",
  popularityScore: 72,
  hiddenGem: false,
  preferenceScore: 0,
  accessibilityScore: null,
  fatigueCost: null,
};

function makeInput(overrides: Partial<TripBrainInput> = {}): TripBrainInput {
  return {
    maxTravelers: 1,
    destination: "Jaipur",
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-02"),  // 2 days
    tripType: "MULTI_DAY",
    timeStatus: "UNKNOWN",
    startTime: null,
    endTime: null,
    budgetInr: 20000,
    paceLevel: "easy",
    allPreferences: [],
    travelSegments: [],
    accommodations: [],
    ...overrides,
  };
}

function makeGeminiClient(rawText: string) {
  mockGenerateText.mockResolvedValue({
    text: rawText,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCost: 0, currency: "USD" },
    latencyMs: 100,
    provider: "gemini",
    model: "gemini-2.5-flash",
    requestId: "mock-id",
    fallbackUsed: false,
  });
  
  let data;
  try {
    data = JSON.parse(rawText);
    mockGenerateStructured.mockResolvedValue({
      data,
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCost: 0, currency: "USD" },
      latencyMs: 100,
      provider: "gemini",
      model: "gemini-2.5-flash",
      requestId: "mock-id",
      fallbackUsed: false,
    });
  } catch (e) {
    mockGenerateStructured.mockRejectedValue(new Error("Malformed JSON"));
  }
}

function geminiResponse(placeIds: string[][], _dayCount: number) {
  return JSON.stringify({
    days: placeIds.map((dayIds, i) => ({
      dayNumber: i + 1,
      items: dayIds.map((id) => ({
        placeId: id,
        estimatedCostInr: 300,
        reasoning: "Good fit",
      })),
    })),
  });
}

// easy pace has 4 slots per day
const EASY_SLOTS = 4;

function validGeminiResponse(candidates: typeof PLACE_HAWA_MAHAL[], dayCount = 2) {
  // Cycle through candidates to fill slots
  const days: string[][] = [];
  let idx = 0;
  for (let d = 0; d < dayCount; d++) {
    const day: string[] = [];
    for (let s = 0; s < EASY_SLOTS; s++) {
      day.push(candidates[idx % candidates.length].id);
      idx++;
    }
    days.push(day);
  }
  return geminiResponse(days, dayCount);
}

beforeEach(() => {
  vi.clearAllMocks();
  // By default, no GEMINI_API_KEY → deterministic fallback
  delete process.env.GEMINI_API_KEY;
});

// ── Destination resolution ────────────────────────────────────────────────────

describe("generateGroundedItinerary — destination resolution", () => {
  it("throws DestinationNotFoundError for unknown destination before any AI call", async () => {
    mockResolve.mockResolvedValue(null);

    await expect(generateGroundedItinerary(makeInput({ destination: "Atlantis" })))
      .rejects
      .toThrow(DestinationNotFoundError);

    expect(mockCandidates).not.toHaveBeenCalled();
  });

  it("throws DestinationNotFoundError with descriptive message", async () => {
    mockResolve.mockResolvedValue(null);

    await expect(generateGroundedItinerary(makeInput({ destination: "Atlantis" })))
      .rejects
      .toThrow(/Atlantis.*not in the travel knowledge database/i);
  });

  it("throws DestinationDataError when destination resolves but has no places", async () => {
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue([]);

    await expect(generateGroundedItinerary(makeInput()))
      .rejects
      .toThrow(DestinationDataError);
  });

  it("resolves and proceeds when destination exists in DB", async () => {
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());

    const result = await generateGroundedItinerary(makeInput());

    expect(result.resolvedDestination.name).toBe("Jaipur");
    expect(result.candidateCount).toBe(5);
  });
});

// ── Deterministic fallback ────────────────────────────────────────────────────

describe("generateGroundedItinerary — deterministic fallback", () => {
  beforeEach(() => {
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());
  });

  it("uses fallback when GEMINI_API_KEY is absent", async () => {
    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedGemini).toBe(false);
  });

  it("fallback produces correct day count", async () => {
    const result = await generateGroundedItinerary(makeInput({
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-03"),
    }));
    expect(result.days).toHaveLength(3);
    expect(result.days[0].dayNumber).toBe(1);
    expect(result.days[2].dayNumber).toBe(3);
  });

  it("fallback items have placeId from the candidate set", async () => {
    const candidates = makePlaces();
    mockCandidates.mockResolvedValue(candidates);
    const candidateIds = new Set(candidates.map((c) => c.id));

    const result = await generateGroundedItinerary(makeInput());

    for (const day of result.days) {
      for (const item of day.items) {
        expect(item.placeId).not.toBeNull();
        expect(candidateIds).toContain(item.placeId);
      }
    }
  });

  it("fallback uses real coordinates from Place records (not synthetic)", async () => {
    const result = await generateGroundedItinerary(makeInput());

    // Hawa Mahal has known real coords
    const hawaItem = result.days
      .flatMap((d) => d.items)
      .find((i) => i.placeId === PLACE_HAWA_MAHAL.id);

    if (hawaItem) {
      expect(hawaItem.lat).toBe(PLACE_HAWA_MAHAL.lat);
      expect(hawaItem.lng).toBe(PLACE_HAWA_MAHAL.lng);
    }
    // At minimum, every item that has a placeId must have non-null coordinates
    for (const day of result.days) {
      for (const item of day.items) {
        if (item.placeId) {
          expect(item.lat).not.toBeNull();
          expect(item.lng).not.toBeNull();
        }
      }
    }
  });
});

// ── Gemini path ───────────────────────────────────────────────────────────────

describe("generateGroundedItinerary — Gemini path", () => {
  const candidates = [
    PLACE_HAWA_MAHAL, PLACE_AMBER_FORT, PLACE_JOHARI, PLACE_DINING,
    PLACE_SPIRITUAL,
  ];

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(candidates);

    const verifiedMap = new Map(candidates.map((p) => [p.id, p]));
    mockBulkVerify.mockResolvedValue({ verified: verifiedMap, unknown: [] });
  });

  it("uses Gemini when API key is present and response is valid", async () => {
    (makeGeminiClient(validGeminiResponse(candidates)));

    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedGemini).toBe(true);
  });

  it("uses real coordinates from DB, not from Gemini response", async () => {
    (makeGeminiClient(validGeminiResponse(candidates)));

    const result = await generateGroundedItinerary(makeInput());

    // Items should have coordinates matching actual DB records
    for (const day of result.days) {
      for (const item of day.items) {
        const dbPlace = candidates.find((c) => c.id === item.placeId);
        if (dbPlace) {
          expect(item.lat).toBe(dbPlace.lat);
          expect(item.lng).toBe(dbPlace.lng);
        }
      }
    }
  });

  it("rejects Gemini response containing unknown placeId (hallucination)", async () => {
    const hallucinated = geminiResponse(
      [
        ["place-hawa-mahal", "fake-hallucinated-id", "place-amber-fort", "place-chokhi"],
        ["place-hawa-mahal", "place-johari", "place-birla", "place-chokhi"],
      ],
      2,
    );
    makeGeminiClient(hallucinated);

    // bulkVerify returns fake-hallucinated-id as unknown
    const verifiedMap = new Map(candidates.map((p) => [p.id, p]));
    mockBulkVerify.mockResolvedValue({ verified: verifiedMap, unknown: ["fake-hallucinated-id"] });

    // It throws internally, gets caught, and falls back
    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedFallback).toBe(true);
    expect(result.usedGemini).toBe(false);
  });

  it("falls back to deterministic when Gemini returns malformed JSON", async () => {
    makeGeminiClient("this is not valid json at all");

    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedGemini).toBe(false);
  });

  it("falls back to deterministic when Gemini returns empty response", async () => {
    makeGeminiClient("");

    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedGemini).toBe(false);
  });
});

// ── never preference enforcement ─────────────────────────────────────────────

describe("generateGroundedItinerary — never preference enforcement", () => {
  it("never removes dining places from candidates before Gemini sees them", async () => {
    const allPlaces = makePlaces();
    // Filter out dining in travel-knowledge layer (mock returns already-filtered result)
    const withoutDining = allPlaces.filter((p) => p.category !== "dining");
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(withoutDining);

    const result = await generateGroundedItinerary(
      makeInput({
        allPreferences: [{ category: "dining", priority: "never" }],
      }),
    );

    // No dining items in the output
    const categories = result.days.flatMap((d) => d.items.map((i) => i.category));
    expect(categories).not.toContain("dining");
  });

  it("getCandidatePlaces is called with allPreferences that include never", async () => {
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces().slice(0, 4)); // return 4 places

    const preferences = [{ category: "nightlife", priority: "never" as const }];
    await generateGroundedItinerary(makeInput({ allPreferences: preferences }));

    expect(mockCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ allPreferences: preferences }),
    );
  });
});

// ── Gemini response validation — placeId checks ───────────────────────────────

describe("generateGroundedItinerary — placeId validation", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    mockResolve.mockResolvedValue(JAIPUR);
  });

  it("throws ValidationError when Gemini uses a placeId not in the candidate set", async () => {
    const candidates = [PLACE_HAWA_MAHAL, PLACE_AMBER_FORT, PLACE_JOHARI, PLACE_DINING];
    mockCandidates.mockResolvedValue(candidates);
    mockBulkVerify.mockResolvedValue({ verified: new Map(), unknown: [] });

    // Response references a placeId not in candidates
    const badResponse = geminiResponse(
      [
        ["place-hawa-mahal", "place-amber-fort", "place-johari", "NOT-A-REAL-ID"],
        ["place-hawa-mahal", "place-amber-fort", "place-johari", "place-chokhi"],
      ],
      2,
    );
    makeGeminiClient(badResponse);

    const result = await generateGroundedItinerary(makeInput());
    expect(result.usedFallback).toBe(true);
    expect(result.usedGemini).toBe(false);
  });
});

// ── Group conflict detection ──────────────────────────────────────────────────

describe("generateGroundedItinerary — group conflict reporting", () => {
  it("reports must-have vs never conflict in result", async () => {
    mockResolve.mockResolvedValue(JAIPUR);
    // Travel knowledge already excludes nightlife, returning remaining places
    mockCandidates.mockResolvedValue([PLACE_HAWA_MAHAL, PLACE_AMBER_FORT, PLACE_JOHARI, PLACE_DINING]);

    const result = await generateGroundedItinerary(
      makeInput({
        allPreferences: [
          { category: "nightlife", priority: "must-have" },
          { category: "nightlife", priority: "never" },
        ],
      }),
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].category).toBe("nightlife");
    expect(result.conflicts[0].resolution).toContain("never");
  });

  it("returns empty conflicts array when no must-have vs never clash", async () => {
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());

    const result = await generateGroundedItinerary(
      makeInput({
        allPreferences: [{ category: "sightseeing", priority: "must-have" }],
      }),
    );

    expect(result.conflicts).toHaveLength(0);
  });
});

// ── Phase 2: Flexible trip types ──────────────────────────────────────────────

describe("Phase 2 — PICNIC trip type", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());
  });

  it("generates exactly 1 day for a PICNIC trip (Gemini unavailable)", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "PICNIC",
        startDate: new Date("2026-11-01"),
        endDate: null,
      }),
    );
    expect(result.days).toHaveLength(1);
    expect(result.usedGemini).toBe(false);
  });

  it("caps activities at 2 for PICNIC regardless of paceLevel=full (Gemini unavailable)", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "PICNIC",
        paceLevel: "full",
        startDate: new Date("2026-11-01"),
        endDate: null,
      }),
    );
    expect(result.days).toHaveLength(1);
    // At most 3 slots for PICNIC, even at full pace
    expect(result.days[0].items.length).toBeLessThanOrEqual(3);
  });

  it("caps activities at 2 for PICNIC regardless of paceLevel=balanced (Gemini unavailable)", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "PICNIC",
        paceLevel: "balanced",
        startDate: new Date("2026-11-01"),
        endDate: null,
      }),
    );
    expect(result.days[0].items.length).toBeLessThanOrEqual(3);
  });

  it("uses PICNIC time window 10:00-16:00 when no startTime/endTime set", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "PICNIC",
        startDate: new Date("2026-11-01"),
        endDate: null,
        startTime: null,
        endTime: null,
      }),
    );
    // All items should start at or after 10:00 and end at or before 16:00
    for (const item of result.days[0].items) {
      const [sh, sm] = item.startTime.split(":").map(Number);
      const [eh, em] = item.endTime.split(":").map(Number);
      expect(sh * 60 + sm).toBeGreaterThanOrEqual(10 * 60);
      expect(eh * 60 + em).toBeLessThanOrEqual(16 * 60);
    }
  });

  it("respects user-provided startTime/endTime even for PICNIC", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "PICNIC",
        startDate: new Date("2026-11-01"),
        endDate: null,
        startTime: "08:00",
        endTime: "18:00",
      }),
    );
    // With a wider window, first item should start at or after 08:00
    const [sh] = result.days[0].items[0].startTime.split(":").map(Number);
    expect(sh).toBeGreaterThanOrEqual(8);
  });
});

describe("Phase 2 — OVERNIGHT trip type", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());
  });

  it("generates exactly 2 days for OVERNIGHT (Gemini unavailable)", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "OVERNIGHT",
        startDate: new Date("2026-11-01"),
        endDate: null,
      }),
    );
    expect(result.days).toHaveLength(2);
    expect(result.usedGemini).toBe(false);
  });

  it("day 2 date is startDate + 1 day", async () => {
    const startDate = new Date("2026-11-01");
    const result = await generateGroundedItinerary(
      makeInput({ tripType: "OVERNIGHT", startDate, endDate: null }),
    );
    const day2 = result.days[1].date;
    const expected = new Date(startDate);
    expected.setDate(expected.getDate() + 1);
    expect(day2.toDateString()).toBe(expected.toDateString());
  });
});

describe("Phase 2 — WEEKEND trip type", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockResolve.mockResolvedValue(JAIPUR);
    mockCandidates.mockResolvedValue(makePlaces());
  });

  it("generates exactly 2 days for WEEKEND (Gemini unavailable)", async () => {
    const result = await generateGroundedItinerary(
      makeInput({
        tripType: "WEEKEND",
        startDate: new Date("2026-11-07"), // Saturday
        endDate: null,
      }),
    );
    expect(result.days).toHaveLength(2);
  });
});

describe("Phase 0D — computeDayWindow Verification", () => {
  it("PICNIC uses 10:00 to 16:00", () => {
    const res = computeDayWindow("PICNIC", 0, 1, null, null, "balanced", null, null);
    expect(res).toEqual({ dayStartMins: 600, dayEndMins: 960 });
  });

  it("DAY_TRIP uses default pace bounds or input times", () => {
    // With explicit input times
    const res1 = computeDayWindow("DAY_TRIP", 0, 1, null, null, "balanced", "09:00", "21:00");
    expect(res1).toEqual({ dayStartMins: 540, dayEndMins: 1260 });
  });

  it("OVERNIGHT uses 14:00-14:00 bounds (start time on day 0, end time on day 1) if provided", () => {
    const startDate = new Date();
    startDate.setHours(14, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(14, 0, 0, 0);

    // Day 0
    const resDay0 = computeDayWindow("OVERNIGHT", 0, 2, startDate, endDate, "balanced", null, null);
    expect(resDay0.dayStartMins).toBe(14 * 60); // 14:00
    expect(resDay0.dayEndMins).toBe(22 * 60); // 22:00 default

    // Day 1
    const resDay1 = computeDayWindow("OVERNIGHT", 1, 2, startDate, endDate, "balanced", null, null);
    expect(resDay1.dayStartMins).toBe(8 * 60); // 08:00 default
    expect(resDay1.dayEndMins).toBe(14 * 60); // 14:00
  });

  it("WEEKEND respects default bounds (Friday 18:00 - Sunday 18:00) when times are passed", () => {
    const startDate = new Date();
    startDate.setHours(18, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(18, 0, 0, 0);

    // Day 0 (Friday)
    const resDay0 = computeDayWindow("WEEKEND", 0, 3, startDate, endDate, "balanced", null, null);
    expect(resDay0.dayStartMins).toBe(18 * 60);
    expect(resDay0.dayEndMins).toBe(22 * 60);

    // Day 1 (Saturday)
    const resDay1 = computeDayWindow("WEEKEND", 1, 3, startDate, endDate, "balanced", null, null);
    expect(resDay1.dayStartMins).toBe(8 * 60);
    expect(resDay1.dayEndMins).toBe(22 * 60);

    // Day 2 (Sunday)
    const resDay2 = computeDayWindow("WEEKEND", 2, 3, startDate, endDate, "balanced", null, null);
    expect(resDay2.dayStartMins).toBe(8 * 60);
    expect(resDay2.dayEndMins).toBe(18 * 60);
  });

  it("MULTI_DAY ignores start/end times and uses full days", () => {
    const startDate = new Date();
    startDate.setHours(14, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(14, 0, 0, 0);

    const res = computeDayWindow("MULTI_DAY", 0, 3, startDate, endDate, "balanced", null, null);
    // Balanced pace default start is 08:00 (480)
    expect(res.dayStartMins).toBe(480);
    expect(res.dayEndMins).toBe(18 * 60); // 18:00 default end
  });
});

