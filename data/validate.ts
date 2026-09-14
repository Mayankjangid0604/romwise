/**
 * Validates master data JSON files before import.
 * Run: npx tsx data/validate.ts
 * Exit code 0 = valid, 1 = errors found.
 */

import * as fs from "fs";
import * as path from "path";

const PLACE_CATEGORIES = [
  "sightseeing", "culture", "history", "nature", "adventure",
  "dining", "nightlife", "shopping", "relaxation", "photography",
  "spiritual", "family", "local_experience",
] as const;

const SOURCE_TYPES = ["curated", "ai_enriched", "imported", "official", "fixture", "osm", "wikidata"] as const;
const DATA_STATUSES = ["seed", "verified", "needs_review", "deprecated"] as const;
const DESTINATION_TYPES = ["city", "beach", "mountain", "heritage", "hill_station", "wildlife", "island", "pilgrimage", "other"] as const;

// Rough India bounds (includes nearby territories)
const INDIA_LAT = { min: 6.5, max: 37.5 };
const INDIA_LNG = { min: 68.0, max: 98.0 };

interface DestinationRecord {
  name: string;
  slug: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  destinationType?: string;
  description?: string;
  dataStatus?: string;
  confidence?: number;
  sourceName?: string;
  sourceUrl?: string;
  aliases?: string[];
}

interface PlaceRecord {
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
  description?: string | null;
  area?: string | null;
  costMinInr?: number | null;
  costMaxInr?: number | null;
  costStatus?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  openingDays?: string | null;
  openingHoursStatus?: string | null;
  bestSeason?: string | null;
  seasonStatus?: string | null;
  durationMinutes?: number | null;
  fatigueCost?: number | null;
  accessibilityScore?: number | null;
  popularityScore?: number;
  hiddenGem?: boolean;
  sourceType?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  confidence?: number;
  dataStatus?: string;
}

interface PlaceFile {
  destinationSlug: string;
  sourceNote?: string;
  places: PlaceRecord[];
}

let errors = 0;
let warnings = 0;

function err(file: string, msg: string) {
  console.error(`  ERROR [${file}] ${msg}`);
  errors++;
}

function warn(file: string, msg: string) {
  console.warn(`  WARN  [${file}] ${msg}`);
  warnings++;
}

function validateCoords(file: string, lat: number, lng: number, name: string) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    err(file, `${name}: lat/lng must be numbers`);
    return;
  }
  if (lat < INDIA_LAT.min || lat > INDIA_LAT.max) {
    err(file, `${name}: lat ${lat} is outside India bounds (${INDIA_LAT.min}–${INDIA_LAT.max})`);
  }
  if (lng < INDIA_LNG.min || lng > INDIA_LNG.max) {
    err(file, `${name}: lng ${lng} is outside India bounds (${INDIA_LNG.min}–${INDIA_LNG.max})`);
  }
}

// ─── Validate destinations.json ───────────────────────────────────────────────

const destinationsPath = path.resolve(__dirname, "master/destinations.json");
console.log("\n=== Validating destinations.json ===");

if (!fs.existsSync(destinationsPath)) {
  console.error("  ERROR: master/destinations.json not found");
  process.exit(1);
}

const destinations: DestinationRecord[] = JSON.parse(fs.readFileSync(destinationsPath, "utf-8"));
const destinationSlugs = new Set<string>();
const aliasSet = new Set<string>();

for (const d of destinations) {
  const label = d.name ?? "(unnamed)";

  if (!d.name?.trim()) err("destinations.json", `${label}: name is required`);
  if (!d.slug?.trim()) err("destinations.json", `${label}: slug is required`);
  if (!d.state?.trim()) err("destinations.json", `${label}: state is required`);
  if (!d.country?.trim()) err("destinations.json", `${label}: country is required`);

  if (d.slug) {
    if (destinationSlugs.has(d.slug)) err("destinations.json", `${label}: duplicate slug "${d.slug}"`);
    destinationSlugs.add(d.slug);
  }

  validateCoords("destinations.json", d.lat, d.lng, label);

  if (d.destinationType && !DESTINATION_TYPES.includes(d.destinationType as typeof DESTINATION_TYPES[number])) {
    err("destinations.json", `${label}: invalid destinationType "${d.destinationType}"`);
  }

  if (d.dataStatus && !DATA_STATUSES.includes(d.dataStatus as typeof DATA_STATUSES[number])) {
    err("destinations.json", `${label}: invalid dataStatus "${d.dataStatus}"`);
  }

  if (d.confidence != null && (d.confidence < 0 || d.confidence > 1)) {
    err("destinations.json", `${label}: confidence must be 0.0–1.0`);
  }

  for (const alias of (d.aliases ?? [])) {
    if (aliasSet.has(alias.toLowerCase())) {
      warn("destinations.json", `${label}: duplicate alias "${alias}" across destinations`);
    }
    aliasSet.add(alias.toLowerCase());
  }
}

console.log(`  Found ${destinations.length} destinations, ${aliasSet.size} total aliases`);

// ─── Validate place files ──────────────────────────────────────────────────────

const placesDir = path.resolve(__dirname, "master/places");
const placeFiles = fs.readdirSync(placesDir).filter((f) => f.endsWith(".json"));
const allPlaceSlugs = new Set<string>();
let totalPlaces = 0;

console.log(`\n=== Validating ${placeFiles.length} place files ===`);

for (const fileName of placeFiles.sort()) {
  const filePath = path.join(placesDir, fileName);
  const raw: PlaceFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!raw.destinationSlug) {
    err(fileName, "missing destinationSlug");
    continue;
  }

  if (!destinationSlugs.has(raw.destinationSlug)) {
    err(fileName, `destinationSlug "${raw.destinationSlug}" not found in destinations.json`);
  }

  if (!Array.isArray(raw.places)) {
    err(fileName, "places must be an array");
    continue;
  }

  console.log(`  ${fileName}: ${raw.places.length} places (destination: ${raw.destinationSlug})`);

  for (const p of raw.places) {
    const label = p.name ?? "(unnamed)";

    if (!p.name?.trim()) err(fileName, `${label}: name is required`);
    if (!p.slug?.trim()) err(fileName, `${label}: slug is required`);

    if (p.slug) {
      if (allPlaceSlugs.has(p.slug)) {
        err(fileName, `${label}: duplicate slug "${p.slug}" — slugs must be globally unique`);
      }
      allPlaceSlugs.add(p.slug);
    }

    if (!p.category) {
      err(fileName, `${label}: category is required`);
    } else if (!PLACE_CATEGORIES.includes(p.category as typeof PLACE_CATEGORIES[number])) {
      err(fileName, `${label}: invalid category "${p.category}". Must be one of: ${PLACE_CATEGORIES.join(", ")}`);
    }

    validateCoords(fileName, p.lat, p.lng, label);

    if (p.confidence != null && (p.confidence < 0 || p.confidence > 1)) {
      err(fileName, `${label}: confidence must be 0.0–1.0, got ${p.confidence}`);
    }

    if (p.popularityScore != null && (p.popularityScore < 0 || p.popularityScore > 100)) {
      err(fileName, `${label}: popularityScore must be 0–100, got ${p.popularityScore}`);
    }

    if (p.fatigueCost != null && (p.fatigueCost < 1 || p.fatigueCost > 5)) {
      err(fileName, `${label}: fatigueCost must be 1–5, got ${p.fatigueCost}`);
    }

    if (p.accessibilityScore != null && (p.accessibilityScore < 1 || p.accessibilityScore > 5)) {
      err(fileName, `${label}: accessibilityScore must be 1–5, got ${p.accessibilityScore}`);
    }

    if (p.sourceType && !SOURCE_TYPES.includes(p.sourceType as typeof SOURCE_TYPES[number])) {
      err(fileName, `${label}: invalid sourceType "${p.sourceType}"`);
    }

    if (p.dataStatus && !DATA_STATUSES.includes(p.dataStatus as typeof DATA_STATUSES[number])) {
      err(fileName, `${label}: invalid dataStatus "${p.dataStatus}"`);
    }

    if (p.costMinInr != null && p.costMaxInr != null && p.costMinInr > p.costMaxInr) {
      err(fileName, `${label}: costMinInr (${p.costMinInr}) > costMaxInr (${p.costMaxInr})`);
    }

    // Warn about missing provenance
    if (!p.sourceUrl) {
      warn(fileName, `${label}: no sourceUrl — provenance unclear`);
    }
    if (!p.confidence) {
      warn(fileName, `${label}: no confidence score`);
    }
  }

  totalPlaces += raw.places.length;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n=== Summary ===`);
console.log(`  Destinations: ${destinations.length}`);
console.log(`  Place files:  ${placeFiles.length}`);
console.log(`  Total places: ${totalPlaces}`);
console.log(`  Errors:       ${errors}`);
console.log(`  Warnings:     ${warnings}`);

if (errors > 0) {
  console.error(`\nValidation FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nValidation PASSED${warnings > 0 ? ` (${warnings} warning(s))` : ""}.`);
  process.exit(0);
}
