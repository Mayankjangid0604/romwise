/**
 * Validates master data JSON files before import.
 * Produces quality reports in data/reports/.
 * Run: npx tsx data/validate.ts
 * Exit code 0 = valid, 1 = errors found.
 */

import * as fs from "fs";
import * as path from "path";

// ── Controlled vocabularies ────────────────────────────────────────────────────

const PLACE_CATEGORIES = [
  "sightseeing", "culture", "history", "nature", "adventure",
  "dining", "nightlife", "shopping", "relaxation", "photography",
  "spiritual", "family", "local_experience",
] as const;

const SOURCE_TYPES = [
  "curated", "ai_enriched", "imported", "official", "fixture",
  "osm", "wikidata", "wikipedia_geosearch",
] as const;

const DATA_STATUSES = ["seed", "verified", "needs_review", "deprecated"] as const;

const DESTINATION_TYPES = [
  "region", "state", "tourism_region",
  "city", "town", "valley", "island",
  "national_park", "wildlife_reserve", "lake",
  "heritage_site", "beach", "mountain", "hill_station",
  "pilgrimage", "circuit", "other",
] as const;

// Rough India bounds (includes nearby territories)
const INDIA_LAT = { min: 6.5, max: 37.5 };
const INDIA_LNG = { min: 68.0, max: 98.0 };

// ── Interfaces ────────────────────────────────────────────────────────────────

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
  sourceType?: string;
  sourceRecordId?: string;
  lastVerifiedAt?: string;
  parentSlug?: string;
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

// ── Counters ───────────────────────────────────────────────────────────────────

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
    err(file, `${name}: lat ${lat} outside India bounds`);
  }
  if (lng < INDIA_LNG.min || lng > INDIA_LNG.max) {
    err(file, `${name}: lng ${lng} outside India bounds`);
  }
}

// ── Validate destinations.json ─────────────────────────────────────────────────

const destinationsPath = path.resolve(__dirname, "master/destinations.json");
console.log("\n=== Validating destinations.json ===");

if (!fs.existsSync(destinationsPath)) {
  console.error("  ERROR: master/destinations.json not found");
  process.exit(1);
}

const destinations: DestinationRecord[] = JSON.parse(
  fs.readFileSync(destinationsPath, "utf-8"),
);
const destinationSlugs = new Set<string>();
const destinationNames = new Set<string>(); // case-insensitive name dedup
const aliasSet = new Set<string>();

for (const d of destinations) {
  const label = d.name ?? "(unnamed)";

  if (!d.name?.trim()) err("destinations.json", `${label}: name is required`);
  if (!d.slug?.trim()) err("destinations.json", `${label}: slug is required`);
  if (!d.state?.trim()) err("destinations.json", `${label}: state is required`);
  if (!d.country?.trim()) err("destinations.json", `${label}: country is required`);

  if (d.slug) {
    if (destinationSlugs.has(d.slug)) {
      err("destinations.json", `${label}: duplicate slug "${d.slug}"`);
    }
    destinationSlugs.add(d.slug);
  }

  if (d.name) {
    const nameKey = d.name.trim().toLowerCase();
    if (destinationNames.has(nameKey)) {
      err("destinations.json", `${label}: duplicate destination name "${d.name}"`);
    }
    destinationNames.add(nameKey);
  }

  validateCoords("destinations.json", d.lat, d.lng, label);

  if (
    d.destinationType &&
    !DESTINATION_TYPES.includes(d.destinationType as typeof DESTINATION_TYPES[number])
  ) {
    err("destinations.json", `${label}: invalid destinationType "${d.destinationType}"`);
  }

  if (d.dataStatus && !DATA_STATUSES.includes(d.dataStatus as typeof DATA_STATUSES[number])) {
    err("destinations.json", `${label}: invalid dataStatus "${d.dataStatus}"`);
  }

  if (d.confidence != null && (d.confidence < 0 || d.confidence > 1)) {
    err("destinations.json", `${label}: confidence must be 0.0–1.0`);
  }

  if (
    d.sourceType &&
    !SOURCE_TYPES.includes(d.sourceType as typeof SOURCE_TYPES[number])
  ) {
    err("destinations.json", `${label}: invalid sourceType "${d.sourceType}"`);
  }

  for (const alias of d.aliases ?? []) {
    if (aliasSet.has(alias.toLowerCase())) {
      warn("destinations.json", `${label}: duplicate alias "${alias}"`);
    }
    aliasSet.add(alias.toLowerCase());
  }
}

// Validate parentSlug references and detect circular hierarchies
for (const d of destinations) {
  if (!d.parentSlug) continue;
  if (!destinationSlugs.has(d.parentSlug)) {
    err("destinations.json", `${d.name}: parentSlug "${d.parentSlug}" not found in destinations`);
  }
  if (d.parentSlug === d.slug) {
    err("destinations.json", `${d.name}: self-referential parentSlug`);
  }
}

// Detect circular hierarchies — full DFS cycle detection (handles A→B→C→A chains)
const parentMap = new Map(
  destinations.filter((d) => d.parentSlug).map((d) => [d.slug, d.parentSlug!]),
);

function detectCycle(startSlug: string): string[] | null {
  const visited = new Set<string>();
  let current: string | undefined = startSlug;
  const path: string[] = [];
  while (current && parentMap.has(current)) {
    if (visited.has(current)) {
      const cycleStart = path.indexOf(current);
      return path.slice(cycleStart);
    }
    visited.add(current);
    path.push(current);
    current = parentMap.get(current);
  }
  return null;
}

const reportedCycles = new Set<string>();
for (const slug of parentMap.keys()) {
  const cycle = detectCycle(slug);
  if (cycle) {
    const key = [...cycle].sort().join(",");
    if (!reportedCycles.has(key)) {
      reportedCycles.add(key);
      err("destinations.json", `Circular hierarchy: ${cycle.join(" → ")} → ${cycle[0]}`);
    }
  }
}

// Detect duplicate destination slugs across the hierarchy
const slugCounts = new Map<string, number>();
for (const d of destinations) {
  slugCounts.set(d.slug, (slugCounts.get(d.slug) ?? 0) + 1);
}
for (const [slug, count] of slugCounts.entries()) {
  if (count > 1) {
    err("destinations.json", `Duplicate destination slug: "${slug}" appears ${count} times`);
  }
}

const topLevel = destinations.filter((d) => !d.parentSlug);
const children = destinations.filter((d) => !!d.parentSlug);
console.log(
  `  Found ${destinations.length} destinations (${topLevel.length} top-level, ${children.length} sub-destinations), ${aliasSet.size} aliases`,
);

// ── Validate place files ───────────────────────────────────────────────────────

const placesDir = path.resolve(__dirname, "master/places");
const placeFiles = fs.readdirSync(placesDir).filter((f) => f.endsWith(".json"));
const allPlaceSlugs = new Set<string>();
let totalPlaces = 0;

// Quality counters
const qualityCounters = {
  withDescription: 0,
  withCoords: 0,
  withCost: 0,
  withHours: 0,
  withDuration: 0,
  withSeason: 0,
  withFatigue: 0,
  withAccessibility: 0,
  withSourceUrl: 0,
  withConfidence: 0,
  needsReview: 0,
  verified: 0,
  deprecated: 0,
  sourceTypes: {} as Record<string, number>,
};

const missingFields: Array<{ destination: string; place: string; missing: string[] }> = [];
const lowConfidence: Array<{ destination: string; place: string; confidence: number }> = [];
const duplicateCandidates: Array<{ destination: string; slug: string; name: string }> = [];

console.log(`\n=== Validating ${placeFiles.length} place files ===`);

for (const fileName of placeFiles.sort()) {
  const filePath = path.join(placesDir, fileName);
  const raw: PlaceFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!raw.destinationSlug) {
    err(fileName, "missing destinationSlug");
    continue;
  }

  if (!destinationSlugs.has(raw.destinationSlug)) {
    err(fileName, `destinationSlug "${raw.destinationSlug}" not in destinations.json`);
  }

  if (!Array.isArray(raw.places)) {
    err(fileName, "places must be an array");
    continue;
  }

  console.log(`  ${fileName}: ${raw.places.length} places (${raw.destinationSlug})`);

  const dest = destinations.find((d) => d.slug === raw.destinationSlug);
  const namesSeen = new Map<string, string>(); // normalized name → slug

  for (const p of raw.places) {
    const label = p.name ?? "(unnamed)";

    if (!p.name?.trim()) err(fileName, `${label}: name is required`);
    if (!p.slug?.trim()) err(fileName, `${label}: slug is required`);

    if (p.slug) {
      if (allPlaceSlugs.has(p.slug)) {
        err(fileName, `${label}: duplicate slug "${p.slug}" — must be globally unique`);
        duplicateCandidates.push({ destination: raw.destinationSlug, slug: p.slug, name: p.name });
      }
      allPlaceSlugs.add(p.slug);
    }

    // Detect near-duplicate names within same destination
    const normalizedName = p.name?.toLowerCase().trim().replace(/\s+/g, " ") ?? "";
    if (namesSeen.has(normalizedName)) {
      warn(fileName, `${label}: possible duplicate name (same as "${namesSeen.get(normalizedName)}")`);
    } else {
      namesSeen.set(normalizedName, p.slug);
    }

    if (!p.category) {
      err(fileName, `${label}: category is required`);
    } else if (!PLACE_CATEGORIES.includes(p.category as typeof PLACE_CATEGORIES[number])) {
      err(fileName, `${label}: invalid category "${p.category}"`);
    }

    validateCoords(fileName, p.lat, p.lng, label);

    // Warn if place coordinates exactly match destination center — likely copy-paste error
    if (dest && p.lat === dest.lat && p.lng === dest.lng) {
      warn(fileName, `${label}: coordinates (${p.lat}, ${p.lng}) exactly match destination center — verify this is intentional`);
    }

    if (p.confidence != null && (p.confidence < 0 || p.confidence > 1)) {
      err(fileName, `${label}: confidence must be 0.0–1.0`);
    }
    if (p.popularityScore != null && (p.popularityScore < 0 || p.popularityScore > 100)) {
      err(fileName, `${label}: popularityScore must be 0–100`);
    }
    if (p.fatigueCost != null && (p.fatigueCost < 1 || p.fatigueCost > 5)) {
      err(fileName, `${label}: fatigueCost must be 1–5`);
    }
    if (p.accessibilityScore != null && (p.accessibilityScore < 1 || p.accessibilityScore > 5)) {
      err(fileName, `${label}: accessibilityScore must be 1–5`);
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

    // Cost semantic invariants: null≠free≠unknown must never be conflated
    if (p.costStatus === "free") {
      if (p.costMinInr !== 0) {
        err(fileName, `${label}: costStatus=free but costMinInr=${p.costMinInr} (must be 0)`);
      }
      if (p.costMaxInr !== 0 && p.costMaxInr != null) {
        err(fileName, `${label}: costStatus=free but costMaxInr=${p.costMaxInr} (must be 0 or null)`);
      }
    }
    if (p.costStatus === "known" && p.costMinInr == null) {
      err(fileName, `${label}: costStatus=known but costMinInr is null (cost must be provided)`);
    }
    if (p.costStatus === "unknown" && p.costMinInr != null) {
      err(fileName, `${label}: costStatus=unknown but costMinInr=${p.costMinInr} (must be null; use free/known for numeric costs)`);
    }
    if (p.costStatus === "unknown" && p.costMaxInr != null) {
      err(fileName, `${label}: costStatus=unknown but costMaxInr=${p.costMaxInr} (must be null)`);
    }

    if (p.durationMinutes != null && p.durationMinutes < 0) {
      err(fileName, `${label}: durationMinutes must be non-negative`);
    }

    // Quality tracking
    const missing: string[] = [];
    if (p.description) qualityCounters.withDescription++;
    else missing.push("description");

    if (p.lat != null && p.lng != null) qualityCounters.withCoords++;

    if (p.costStatus && p.costStatus !== "unknown") qualityCounters.withCost++;
    else missing.push("cost");

    if (p.openingHoursStatus && p.openingHoursStatus !== "unknown") qualityCounters.withHours++;
    else missing.push("openingHours");

    if (p.durationMinutes != null) qualityCounters.withDuration++;
    else missing.push("duration");

    if (p.bestSeason) qualityCounters.withSeason++;
    if (p.fatigueCost != null) qualityCounters.withFatigue++;
    if (p.accessibilityScore != null) qualityCounters.withAccessibility++;
    if (p.sourceUrl) qualityCounters.withSourceUrl++;
    if (p.confidence != null) qualityCounters.withConfidence++;

    if (p.dataStatus === "needs_review" || !p.dataStatus) qualityCounters.needsReview++;
    else if (p.dataStatus === "verified") qualityCounters.verified++;
    else if (p.dataStatus === "deprecated") qualityCounters.deprecated++;

    const st = p.sourceType ?? "unknown";
    qualityCounters.sourceTypes[st] = (qualityCounters.sourceTypes[st] ?? 0) + 1;

    if (missing.length > 0) {
      missingFields.push({ destination: raw.destinationSlug, place: p.name, missing });
    }
    if (p.confidence != null && p.confidence < 0.7) {
      lowConfidence.push({ destination: raw.destinationSlug, place: p.name, confidence: p.confidence });
    }
  }

  totalPlaces += raw.places.length;
}

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n=== Summary ===`);
console.log(`  Destinations: ${destinations.length} (${topLevel.length} top-level, ${children.length} sub)`);
console.log(`  Place files:  ${placeFiles.length}`);
console.log(`  Total places: ${totalPlaces}`);
console.log(`  Errors:       ${errors}`);
console.log(`  Warnings:     ${warnings}`);

if (totalPlaces > 0) {
  console.log(`\n=== Data Quality (${totalPlaces} places) ===`);
  const pct = (n: number) => `${n}/${totalPlaces} (${Math.round((n / totalPlaces) * 100)}%)`;
  console.log(`  With description:    ${pct(qualityCounters.withDescription)}`);
  console.log(`  With coordinates:    ${pct(qualityCounters.withCoords)}`);
  console.log(`  With cost data:      ${pct(qualityCounters.withCost)}`);
  console.log(`  With opening hours:  ${pct(qualityCounters.withHours)}`);
  console.log(`  With duration:       ${pct(qualityCounters.withDuration)}`);
  console.log(`  Verified:            ${pct(qualityCounters.verified)}`);
  console.log(`  Needs review:        ${pct(qualityCounters.needsReview)}`);
  console.log(`  Source types:        ${JSON.stringify(qualityCounters.sourceTypes)}`);
}

// ── Generate reports ───────────────────────────────────────────────────────────

const reportsDir = path.resolve(__dirname, "reports");
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

// data-quality-report.json
const report = {
  generatedAt: new Date().toISOString(),
  destinations: {
    total: destinations.length,
    topLevel: topLevel.length,
    subDestinations: children.length,
    withDescription: destinations.filter((d) => d.description).length,
    withCoordinates: destinations.filter((d) => d.lat != null && d.lng != null).length,
    withSourceUrl: destinations.filter((d) => d.sourceUrl).length,
    needsReview: destinations.filter((d) => !d.dataStatus || d.dataStatus === "needs_review").length,
    verified: destinations.filter((d) => d.dataStatus === "verified").length,
  },
  places: {
    total: totalPlaces,
    withDescription: qualityCounters.withDescription,
    withCoordinates: qualityCounters.withCoords,
    withCost: qualityCounters.withCost,
    withOpeningHours: qualityCounters.withHours,
    withDuration: qualityCounters.withDuration,
    withSeason: qualityCounters.withSeason,
    withFatigue: qualityCounters.withFatigue,
    withAccessibility: qualityCounters.withAccessibility,
    withSourceUrl: qualityCounters.withSourceUrl,
    withConfidence: qualityCounters.withConfidence,
    verified: qualityCounters.verified,
    needsReview: qualityCounters.needsReview,
    sourceTypes: qualityCounters.sourceTypes,
  },
  placesPerDestination: placeFiles.reduce(
    (acc, fileName) => {
      const raw: PlaceFile = JSON.parse(
        fs.readFileSync(path.join(placesDir, fileName), "utf-8"),
      );
      acc[raw.destinationSlug] = raw.places.length;
      return acc;
    },
    {} as Record<string, number>,
  ),
  validationErrors: errors,
  validationWarnings: warnings,
};

fs.writeFileSync(
  path.join(reportsDir, "data-quality-report.json"),
  JSON.stringify(report, null, 2),
);

// missing-fields.csv
if (missingFields.length > 0) {
  const csv = [
    "destination,place,missing_fields",
    ...missingFields.map((r) => `${r.destination},"${r.place}","${r.missing.join("|")}"`),
  ].join("\n");
  fs.writeFileSync(path.join(reportsDir, "missing-fields.csv"), csv);
}

// low-confidence-records.csv
if (lowConfidence.length > 0) {
  const csv = [
    "destination,place,confidence",
    ...lowConfidence.map((r) => `${r.destination},"${r.place}",${r.confidence}`),
  ].join("\n");
  fs.writeFileSync(path.join(reportsDir, "low-confidence-records.csv"), csv);
}

// duplicate-records.csv
if (duplicateCandidates.length > 0) {
  const csv = [
    "destination,slug,name",
    ...duplicateCandidates.map((r) => `${r.destination},${r.slug},"${r.name}"`),
  ].join("\n");
  fs.writeFileSync(path.join(reportsDir, "duplicate-records.csv"), csv);
}

console.log(`\nReports written to data/reports/`);

if (errors > 0) {
  console.error(`\nValidation FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nValidation PASSED${warnings > 0 ? ` (${warnings} warning(s))` : ""}.`);
  process.exit(0);
}
