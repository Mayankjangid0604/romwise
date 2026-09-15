/**
 * Regression test for the place importer enrichment bug.
 *
 * BUG: The upsert `update` block was missing all enrichment fields
 * (description, cost, hours, season, fatigue, accessibility, etc.).
 * Enriching a stub record in JSON had no effect on the DB because
 * Prisma never received the fields.
 *
 * FIX: Added all enrichment fields to the update block using `?? undefined`
 * so that null JSON values (genuinely unknown) skip the update and preserve
 * the existing DB value, while non-null values are written.
 *
 * These tests must remain passing. Do NOT delete or weaken them.
 */

import { describe, it, expect } from "vitest";
import { buildPlaceUpdatePayload } from "../../../data/import";

// ── Minimal valid place record ────────────────────────────────────────────────

const BASE = {
  name: "Test Place",
  slug: "test-place",
  category: "sightseeing" as const,
  lat: 28.6139,
  lng: 77.209,
};

// ── All enrichment fields that must appear in the update payload ──────────────

const ENRICHMENT_FIELDS = [
  "description",
  "costMinInr",
  "costMaxInr",
  "costStatus",
  "openingTime",
  "closingTime",
  "openingDays",
  "openingHoursStatus",
  "bestSeason",
  "seasonStatus",
  "durationMinutes",
  "fatigueCost",
  "accessibilityScore",
  "popularityScore",
  "hiddenGem",
  "sourceType",
  "sourceName",
  "sourceUrl",
  "sourceRecordId",
  "confidence",
  "dataStatus",
  "area",
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildPlaceUpdatePayload", () => {
  it("includes lat, lng, category in every update", () => {
    const payload = buildPlaceUpdatePayload({ ...BASE });
    expect(payload.lat).toBe(BASE.lat);
    expect(payload.lng).toBe(BASE.lng);
    expect(payload.category).toBe(BASE.category);
  });

  it("includes all enrichment fields as keys in the returned object", () => {
    // Every enrichment field must be a key in the payload object.
    // If any key is absent, Prisma silently skips it — the regression re-occurs.
    const payload = buildPlaceUpdatePayload({ ...BASE });
    for (const field of ENRICHMENT_FIELDS) {
      expect(
        Object.prototype.hasOwnProperty.call(payload, field),
        `update payload is missing enrichment field: "${field}"`,
      ).toBe(true);
    }
  });

  it("maps non-null JSON values to those values in the payload", () => {
    const enriched = {
      ...BASE,
      description: "A beautiful historic fort",
      costMinInr: 50,
      costMaxInr: 500,
      costStatus: "known",
      openingTime: "09:00",
      closingTime: "17:00",
      openingDays: "Daily 09:00–17:00",
      openingHoursStatus: "known",
      bestSeason: "Oct–Mar",
      seasonStatus: "known",
      durationMinutes: 120,
      fatigueCost: 3,
      accessibilityScore: 4,
      popularityScore: 80,
      hiddenGem: false,
      sourceType: "curated",
      sourceName: "Wikipedia",
      sourceUrl: "https://en.wikipedia.org/wiki/Example",
      sourceRecordId: "12345",
      confidence: 0.9,
      dataStatus: "needs_review",
      area: "Old City",
    };

    const payload = buildPlaceUpdatePayload(enriched);

    expect(payload.description).toBe("A beautiful historic fort");
    expect(payload.costMinInr).toBe(50);
    expect(payload.costMaxInr).toBe(500);
    expect(payload.costStatus).toBe("known");
    expect(payload.openingTime).toBe("09:00");
    expect(payload.closingTime).toBe("17:00");
    expect(payload.openingDays).toBe("Daily 09:00–17:00");
    expect(payload.openingHoursStatus).toBe("known");
    expect(payload.bestSeason).toBe("Oct–Mar");
    expect(payload.seasonStatus).toBe("known");
    expect(payload.durationMinutes).toBe(120);
    expect(payload.fatigueCost).toBe(3);
    expect(payload.accessibilityScore).toBe(4);
    expect(payload.popularityScore).toBe(80);
    expect(payload.hiddenGem).toBe(false);
    expect(payload.sourceType).toBe("curated");
    expect(payload.sourceName).toBe("Wikipedia");
    expect(payload.sourceUrl).toBe("https://en.wikipedia.org/wiki/Example");
    expect(payload.sourceRecordId).toBe("12345");
    expect(payload.confidence).toBe(0.9);
    expect(payload.dataStatus).toBe("needs_review");
    expect(payload.area).toBe("Old City");
  });

  it("maps null JSON values to undefined (Prisma skips the field, preserving DB value)", () => {
    // This is the critical invariant: null in JSON means "we don't know" —
    // it must NOT overwrite an existing DB value. undefined tells Prisma to skip.
    const stub = {
      ...BASE,
      description: null,
      costMinInr: null,
      costMaxInr: null,
      costStatus: null,
      openingTime: null,
      closingTime: null,
      openingDays: null,
      openingHoursStatus: null,
      bestSeason: null,
      seasonStatus: null,
      durationMinutes: null,
      fatigueCost: null,
      accessibilityScore: null,
      area: null,
    };

    const payload = buildPlaceUpdatePayload(stub);

    // All null fields must produce undefined in the payload, not null.
    // Passing null to Prisma update would SET the DB field to null.
    // Passing undefined tells Prisma to leave the DB field untouched.
    expect(payload.description).toBeUndefined();
    expect(payload.costMinInr).toBeUndefined();
    expect(payload.costMaxInr).toBeUndefined();
    expect(payload.costStatus).toBeUndefined();
    expect(payload.openingTime).toBeUndefined();
    expect(payload.closingTime).toBeUndefined();
    expect(payload.openingDays).toBeUndefined();
    expect(payload.openingHoursStatus).toBeUndefined();
    expect(payload.bestSeason).toBeUndefined();
    expect(payload.seasonStatus).toBeUndefined();
    expect(payload.durationMinutes).toBeUndefined();
    expect(payload.fatigueCost).toBeUndefined();
    expect(payload.accessibilityScore).toBeUndefined();
    expect(payload.area).toBeUndefined();
  });

  it("zero costMinInr/costMaxInr (free place) maps to 0, not undefined", () => {
    // free place: costMinInr=0, costMaxInr=0 — these are NOT null/unknown,
    // they are known zero-cost values and must be written to the DB.
    const free = {
      ...BASE,
      costMinInr: 0,
      costMaxInr: 0,
      costStatus: "free",
    };
    const payload = buildPlaceUpdatePayload(free);
    // 0 ?? undefined = 0  (0 is falsy but ?? only checks null/undefined)
    expect(payload.costMinInr).toBe(0);
    expect(payload.costMaxInr).toBe(0);
    expect(payload.costStatus).toBe("free");
  });

  it("hiddenGem=false maps to false, not undefined", () => {
    // false ?? undefined = false  (false is falsy but ?? only checks null/undefined)
    const payload = buildPlaceUpdatePayload({ ...BASE, hiddenGem: false });
    expect(payload.hiddenGem).toBe(false);
  });
});
