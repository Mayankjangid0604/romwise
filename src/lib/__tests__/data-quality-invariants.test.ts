/**
 * Regression tests for data quality invariants discovered during the
 * Batch 3C whole-dataset audit.
 *
 * These tests read the JSON master files directly (no DB, no network).
 * They protect invariants that the validator also checks, but as unit tests
 * they run in CI on every commit via `npm test`.
 *
 * Do NOT delete or weaken these tests.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Load all place records ────────────────────────────────────────────────────

interface PlaceRecord {
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
  description?: string | null;
  costMinInr?: number | null;
  costMaxInr?: number | null;
  costStatus?: string | null;
  durationMinutes?: number | null;
  fatigueCost?: number | null;
  accessibilityScore?: number | null;
  hiddenGem?: boolean | null;
  openingHoursStatus?: string | null;
  seasonStatus?: string | null;
  sourceType?: string | null;
  confidence?: number | null;
  dataStatus?: string | null;
  _file: string;
  _destSlug: string;
}

function loadAllPlaces(): PlaceRecord[] {
  const placesDir = path.resolve(__dirname, "../../../data/master/places");
  const files = fs.readdirSync(placesDir).filter((f) => f.endsWith(".json"));
  const records: PlaceRecord[] = [];
  for (const fileName of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(placesDir, fileName), "utf-8"));
    for (const p of raw.places ?? []) {
      records.push({ ...p, _file: fileName, _destSlug: raw.destinationSlug });
    }
  }
  return records;
}

const ALL_PLACES = loadAllPlaces();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("cost invariants (null ≠ free ≠ unknown)", () => {
  it("free places must have costMinInr === 0", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.costStatus === "free" && p.costMinInr !== 0,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });

  it("free places must have costMaxInr === 0 or null", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.costStatus === "free" && p.costMaxInr !== 0 && p.costMaxInr !== null,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });

  it("known-cost places must have non-null costMinInr", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.costStatus === "known" && p.costMinInr == null,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });

  it("unknown-cost places must have null costMinInr (0 means free, not unknown)", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.costStatus === "unknown" && p.costMinInr !== null && p.costMinInr !== undefined,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });

  it("unknown-cost places must have null costMaxInr", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.costStatus === "unknown" && p.costMaxInr !== null && p.costMaxInr !== undefined,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });

  it("costMinInr must not exceed costMaxInr", () => {
    const violations = ALL_PLACES.filter(
      (p) =>
        p.costMinInr != null &&
        p.costMaxInr != null &&
        p.costMinInr > p.costMaxInr,
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });
});

describe("slug uniqueness", () => {
  it("all place slugs must be globally unique across all destination files", () => {
    const seen = new Map<string, string>(); // slug → file
    const collisions: string[] = [];
    for (const p of ALL_PLACES) {
      if (seen.has(p.slug)) {
        collisions.push(`"${p.slug}" in ${p._file} also in ${seen.get(p.slug)}`);
      } else {
        seen.set(p.slug, p._file);
      }
    }
    expect(collisions).toHaveLength(0);
  });
});

describe("coordinate invariants", () => {
  const INDIA_LAT = { min: 6.5, max: 37.5 };
  const INDIA_LNG = { min: 68.0, max: 98.0 };

  it("all place coordinates must be within India geographic bounds", () => {
    const violations = ALL_PLACES.filter(
      (p) =>
        p.lat < INDIA_LAT.min ||
        p.lat > INDIA_LAT.max ||
        p.lng < INDIA_LNG.min ||
        p.lng > INDIA_LNG.max,
    );
    expect(violations, violations.map((p) => `${p.slug}: (${p.lat}, ${p.lng})`).join(", ")).toHaveLength(0);
  });

  it("no place should have lat and lng swapped (lng should not be < lat for India)", () => {
    // In India: lat ~8–37°N, lng ~68–98°E; if lng < lat that's impossible
    const violations = ALL_PLACES.filter((p) => p.lng < p.lat);
    expect(violations, violations.map((p) => `${p.slug}: lat=${p.lat} lng=${p.lng}`).join(", ")).toHaveLength(0);
  });
});

describe("permitted category values", () => {
  const VALID_CATEGORIES = new Set([
    "sightseeing", "culture", "history", "nature", "adventure",
    "dining", "nightlife", "shopping", "relaxation", "photography",
    "spiritual", "family", "local_experience",
  ]);

  it("all places must use a valid category value", () => {
    const violations = ALL_PLACES.filter((p) => !VALID_CATEGORIES.has(p.category));
    expect(violations, violations.map((p) => `${p.slug}: "${p.category}"`).join(", ")).toHaveLength(0);
  });
});

describe("required fields present", () => {
  it("all places must have a slug", () => {
    const violations = ALL_PLACES.filter((p) => !p.slug?.trim());
    expect(violations).toHaveLength(0);
  });

  it("all places must have a name", () => {
    const violations = ALL_PLACES.filter((p) => !p.name?.trim());
    expect(violations).toHaveLength(0);
  });

  it("all places must have valid numeric coordinates", () => {
    const violations = ALL_PLACES.filter(
      (p) => typeof p.lat !== "number" || typeof p.lng !== "number",
    );
    expect(violations, violations.map((p) => `${p.slug} (${p._file})`).join(", ")).toHaveLength(0);
  });
});

describe("confidence score range", () => {
  it("confidence must be 0.0–1.0 when present", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.confidence != null && (p.confidence < 0 || p.confidence > 1),
    );
    expect(violations, violations.map((p) => `${p.slug}: ${p.confidence}`).join(", ")).toHaveLength(0);
  });
});

describe("fatigue and accessibility range", () => {
  it("fatigueCost must be 1–5 when present", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.fatigueCost != null && (p.fatigueCost < 1 || p.fatigueCost > 5),
    );
    expect(violations, violations.map((p) => `${p.slug}: ${p.fatigueCost}`).join(", ")).toHaveLength(0);
  });

  it("accessibilityScore must be 1–5 when present", () => {
    const violations = ALL_PLACES.filter(
      (p) => p.accessibilityScore != null && (p.accessibilityScore < 1 || p.accessibilityScore > 5),
    );
    expect(violations, violations.map((p) => `${p.slug}: ${p.accessibilityScore}`).join(", ")).toHaveLength(0);
  });
});

describe("cross-destination duplicate POI protection", () => {
  it("no two places in different destination files should share identical coordinates (known exception: intentional DHR/KSR/Pangong matches excluded)", () => {
    // Intentional coordinate matches are excluded from this check.
    // When adding a new exception, document WHY it is intentional.
    const KNOWN_INTENTIONAL = new Set([
      // Shimla/Darjeeling railway stations: coordinate is the terminus station, which IS the destination
      "kalka-shimla-railway",
      "darjeeling-himalayan-railway",
      // Pangong Tso: the lake is the destination; no sub-centroid exists
      "pangong-tso-viewpoint",
      // Mawkdok Valley: same physical roadside viewpoint legitimately accessible from both
      // shillong and sohra. Tracked as cross-destination duplicate; needs canonicalPlaceId.
      "mawkdok-valley-shillong",
      "mawkdok-valley-sohra",
    ]);

    // Build a map: "lat,lng" → list of (slug, file)
    const coordMap = new Map<string, Array<{ slug: string; file: string }>>();
    for (const p of ALL_PLACES) {
      if (KNOWN_INTENTIONAL.has(p.slug)) continue;
      const key = `${p.lat},${p.lng}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key)!.push({ slug: p.slug, file: p._file });
    }

    // Find coordinate collisions across DIFFERENT files
    const crossFileDuplicates: string[] = [];
    for (const [coord, entries] of coordMap) {
      const files = new Set(entries.map((e) => e.file));
      if (files.size > 1) {
        crossFileDuplicates.push(
          `${coord}: ${entries.map((e) => `${e.slug}(${e.file})`).join(" vs ")}`,
        );
      }
    }

    expect(crossFileDuplicates).toHaveLength(0);
  });
});
