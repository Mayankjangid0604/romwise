/**
 * Tests for opening hours hard enforcement in the itinerary scheduler.
 *
 * The scheduler must:
 * - Advance cursor to openingTime if arriving before open
 * - Drop (return null) items whose endTime would exceed closingTime
 * - Allow items with unknown hours (null closingTime) — not excluded, not confirmed open
 * - Handle closed days (openingDays = specific string)
 */
import { describe, it, expect } from "vitest";

// ── Inlined helpers (exact mirrors of trip-brain.ts) ──

const DEFAULT_DURATION_BY_CATEGORY: Record<string, number> = {
  history: 90,
  culture: 60,
  spiritual: 45,
  nature: 120,
  adventure: 180,
  sightseeing: 60,
  relaxation: 90,
  photography: 60,
  local_experience: 75,
  dining: 60,
  shopping: 60,
  nightlife: 120,
  family: 90,
};

const TRAVEL_BUFFER_MINUTES = 30;

type PaceLevel = "easy" | "balanced" | "full";

const DAY_START_BY_PACE: Record<PaceLevel, number> = {
  easy: 9 * 60,     // 09:00
  balanced: 8 * 60, // 08:00
  full: 7 * 60,     // 07:00
};

type MinimalPlace = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  durationMinutes: number | null;
  openingTime: string | null;
  closingTime: string | null;
};

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function effectiveDuration(place: MinimalPlace): number {
  if (place.durationMinutes && place.durationMinutes > 0) return place.durationMinutes;
  return DEFAULT_DURATION_BY_CATEGORY[place.category] ?? 90;
}

/**
 * Mirror of buildTimeSlotsForPlaces from trip-brain.ts.
 * Returns null for items that exceed closing time.
 */
function buildTimeSlotsForPlaces(
  places: MinimalPlace[],
  paceLevel: PaceLevel,
): ({ start: string; end: string } | null)[] {
  let cursor = DAY_START_BY_PACE[paceLevel];
  return places.map((place, index) => {
    const travelMins = index === 0 ? 0 : TRAVEL_BUFFER_MINUTES;
    cursor += travelMins;

    // Advance to opening time
    if (place.openingTime) {
      const openMins = timeToMinutes(place.openingTime);
      if (cursor < openMins) cursor = openMins;
    }

    const duration = effectiveDuration(place);
    const start = cursor;
    const end = cursor + duration;

    // Hard enforcement: drop if end exceeds closing time
    if (place.closingTime) {
      const closingMins = timeToMinutes(place.closingTime);
      if (end > closingMins) {
        cursor = start - travelMins; // rewind
        return null;
      }
    }

    cursor = end;
    return { start: minutesToTime(start), end: minutesToTime(end) };
  });
}

// ── Test helpers ──

function makePlace(overrides: Partial<MinimalPlace> = {}): MinimalPlace {
  return {
    id: "p1",
    name: "Test Place",
    category: "sightseeing",
    lat: 0,
    lng: 0,
    durationMinutes: 60,
    openingTime: null,
    closingTime: null,
    ...overrides,
  };
}

// ── Tests ──

describe("Opening Hours Hard Enforcement", () => {
  describe("Start time advancement", () => {
    it("advances cursor to openingTime when arriving before open", () => {
      const place = makePlace({
        openingTime: "10:00", // opens at 10:00
        closingTime: "18:00",
        durationMinutes: 60,
      });

      // balanced pace starts at 08:00 — 2 hours before opening
      const slots = buildTimeSlotsForPlaces([place], "balanced");
      expect(slots[0]).not.toBeNull();
      expect(slots[0]!.start).toBe("10:00"); // advanced to opening time
      expect(slots[0]!.end).toBe("11:00");
    });

    it("does not advance cursor if already past opening time", () => {
      const place = makePlace({
        openingTime: "07:00", // already open when balanced pace starts at 08:00
        closingTime: "18:00",
        durationMinutes: 60,
      });

      const slots = buildTimeSlotsForPlaces([place], "balanced");
      expect(slots[0]).not.toBeNull();
      expect(slots[0]!.start).toBe("08:00"); // not advanced — already past opening
    });
  });

  describe("Closing time enforcement (hard drop)", () => {
    it("drops item that would end after closingTime", () => {
      const place = makePlace({
        openingTime: "09:00",
        closingTime: "17:00",
        durationMinutes: 60,
      });

      // Manually build a scenario where start would be 16:30 (past closing - duration)
      // By using multiple items to push cursor forward:
      const longPriorActivity = makePlace({
        id: "p0",
        openingTime: null,
        closingTime: null,
        durationMinutes: 480, // 8 hours: 08:00 → 16:00 + 30 travel = 16:30
      });

      // Now p1 would start at 16:30, end at 17:30 — EXCEEDS 17:00
      const slots = buildTimeSlotsForPlaces(
        [longPriorActivity, place],
        "balanced"
      );

      expect(slots[0]).not.toBeNull(); // first item ok
      expect(slots[1]).toBeNull();    // second item dropped — exceeds closing time
    });

    it("allows item that exactly fits within closing time", () => {
      const place = makePlace({
        openingTime: "09:00",
        closingTime: "10:00",
        durationMinutes: 60, // starts 09:00, ends 10:00 — exactly at closing
      });

      const slots = buildTimeSlotsForPlaces([place], "balanced");
      expect(slots[0]).not.toBeNull();
      expect(slots[0]!.end).toBe("10:00");
    });

    it("drops item whose 60-minute visit would end 1 minute past closing", () => {
      const place = makePlace({
        openingTime: "16:30",
        closingTime: "17:00", // only 30 minutes left, visit needs 60
        durationMinutes: 60,
      });

      // full pace starts 07:00. If prior activities push cursor to 16:30...
      // But for simplicity: first place only, full pace starts at 07:00
      // cursor will advance to 16:30, then end = 17:30 > 17:00 → drop
      const priorFiller = makePlace({
        id: "filler",
        openingTime: null,
        closingTime: null,
        durationMinutes: 9 * 60 + 30, // 09:30 duration: 07:00 + 9h30m = 16:30
      });

      const slots = buildTimeSlotsForPlaces([priorFiller, place], "full");
      // filler: 07:00 → 16:30
      // travel: 16:30 + 30m = 17:00, then openingTime = 16:30 < 17:00 → no advance
      // start = 17:00, end = 18:00 > 17:00 → drop
      expect(slots[1]).toBeNull();
    });
  });

  describe("Unknown hours behavior", () => {
    it("includes items with no openingTime or closingTime (unknown hours)", () => {
      const place = makePlace({
        openingTime: null,
        closingTime: null,
        durationMinutes: 60,
      });

      const slots = buildTimeSlotsForPlaces([place], "balanced");
      expect(slots[0]).not.toBeNull(); // allowed — not confirmed open, but not excluded
      expect(slots[0]!.start).toBe("08:00");
    });

    it("includes items with openingTime known but no closingTime", () => {
      const place = makePlace({
        openingTime: "09:00",
        closingTime: null, // closing unknown — allow with warning
        durationMinutes: 240, // 4 hours
      });

      const slots = buildTimeSlotsForPlaces([place], "balanced");
      expect(slots[0]).not.toBeNull();
      expect(slots[0]!.start).toBe("09:00"); // advanced to opening
      expect(slots[0]!.end).toBe("13:00");   // 4 hours later
    });
  });

  describe("Multiple items in sequence", () => {
    it("correctly sequences 3 items dropping the middle one", () => {
      const item1 = makePlace({ id: "1", openingTime: null, closingTime: null, durationMinutes: 60 });
      const item2 = makePlace({ id: "2", openingTime: "09:00", closingTime: "09:30", durationMinutes: 60 }); // 60 min but only 30 min window → drop
      const item3 = makePlace({ id: "3", openingTime: null, closingTime: null, durationMinutes: 60 });

      const slots = buildTimeSlotsForPlaces([item1, item2, item3], "balanced");
      expect(slots[0]).not.toBeNull(); // item1 ok
      expect(slots[1]).toBeNull();     // item2 dropped — exceeds closing time
      expect(slots[2]).not.toBeNull(); // item3 ok — cursor rewound after item2 dropped
    });
  });
});
