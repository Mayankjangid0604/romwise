/**
 * Imports master data into the database. Idempotent — safe to run multiple times.
 * Uses upsert-by-slug, so existing records are updated with better data.
 * Never deletes existing data.
 *
 * Import order:
 *  1. Register DataSource records
 *  2. Upsert top-level destinations (no parent)
 *  3. Upsert sub-destinations (have parentSlug) — two-pass to resolve IDs
 *  4. Upsert DestinationAlias records
 *  5. Upsert Place records
 *
 * Run: npx tsx data/import.ts
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  /** Slug of parent destination. Resolved to parentDestinationId during import. */
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
  address?: string | null;
  costMinInr?: number | null;
  costMaxInr?: number | null;
  costStatus?: string | null;
  typicalCostInr?: number | null;
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
  places: PlaceRecord[];
}

/**
 * Builds the Prisma update payload for a place upsert.
 * Uses `?? undefined` so that null JSON values (genuinely unknown) do NOT
 * overwrite existing DB values — undefined tells Prisma to skip the field.
 * Only non-null values from the JSON are written to the DB.
 *
 * Exported for regression testing — do not remove the export.
 */
export function buildPlaceUpdatePayload(p: PlaceRecord) {
  return {
    lat: p.lat,
    lng: p.lng,
    category: p.category,
    area: p.area ?? undefined,
    description: p.description ?? undefined,
    costMinInr: p.costMinInr ?? undefined,
    costMaxInr: p.costMaxInr ?? undefined,
    costStatus: p.costStatus ?? undefined,
    typicalCostInr: p.typicalCostInr ?? undefined,
    openingTime: p.openingTime ?? undefined,
    closingTime: p.closingTime ?? undefined,
    openingDays: p.openingDays ?? undefined,
    openingHoursStatus: p.openingHoursStatus ?? undefined,
    bestSeason: p.bestSeason ?? undefined,
    seasonStatus: p.seasonStatus ?? undefined,
    durationMinutes: p.durationMinutes ?? undefined,
    fatigueCost: p.fatigueCost ?? undefined,
    accessibilityScore: p.accessibilityScore ?? undefined,
    popularityScore: p.popularityScore ?? undefined,
    hiddenGem: p.hiddenGem ?? undefined,
    sourceType: p.sourceType ?? undefined,
    sourceName: p.sourceName ?? undefined,
    sourceUrl: p.sourceUrl ?? undefined,
    sourceRecordId: p.sourceRecordId ?? undefined,
    confidence: p.confidence ?? undefined,
    dataStatus: p.dataStatus ?? undefined,
  };
}

async function main() {
  console.log("=== Roamwise Master Data Import ===\n");

  // ── Register data sources ────────────────────────────────────────────────────
  await prisma.dataSource.upsert({
    where: { name: "Wikipedia Geosearch API" },
    create: {
      name: "Wikipedia Geosearch API",
      type: "api",
      url: "https://en.wikipedia.org/w/api.php?action=query&list=geosearch",
      license: "CC BY-SA 4.0",
      attribution: "Wikipedia contributors, via MediaWiki Geosearch API",
      notes: "Coordinate data from Wikipedia article geotags. Coordinates are article-level, not GPS-verified.",
      accessedAt: new Date("2026-09-14"),
    },
    update: { accessedAt: new Date("2026-09-14") },
  });

  await prisma.dataSource.upsert({
    where: { name: "Roamwise Master Data" },
    create: {
      name: "Roamwise Master Data",
      type: "curated",
      notes: "Human-curated master data from data/master/ — compiled from Wikipedia Geosearch, Wikipedia articles, and manual curation.",
    },
    update: {},
  });

  console.log("Data sources registered.");

  // ── Import destinations ──────────────────────────────────────────────────────
  const destinationsPath = path.resolve(__dirname, "master/destinations.json");
  const destinations: DestinationRecord[] = JSON.parse(
    fs.readFileSync(destinationsPath, "utf-8"),
  );

  console.log(`\nImporting ${destinations.length} destinations...`);

  // First pass: upsert all destinations without parent links
  const destinationIdBySlug = new Map<string, string>();
  for (const d of destinations) {
    const record = await prisma.travelDestination.upsert({
      where: { slug: d.slug },
      create: {
        name: d.name,
        slug: d.slug,
        state: d.state,
        country: d.country,
        lat: d.lat,
        lng: d.lng,
        destinationType: d.destinationType ?? null,
        description: d.description ?? null,
        dataStatus: d.dataStatus ?? "needs_review",
        confidence: d.confidence ?? null,
        sourceName: d.sourceName ?? null,
        sourceUrl: d.sourceUrl ?? null,
        sourceType: d.sourceType ?? null,
        sourceRecordId: d.sourceRecordId ?? null,
        lastVerifiedAt: d.lastVerifiedAt ? new Date(d.lastVerifiedAt) : null,
      },
      update: {
        lat: d.lat,
        lng: d.lng,
        destinationType: d.destinationType ?? undefined,
        description: d.description ?? undefined,
        confidence: d.confidence ?? undefined,
        sourceName: d.sourceName ?? undefined,
        sourceUrl: d.sourceUrl ?? undefined,
        sourceType: d.sourceType ?? undefined,
        sourceRecordId: d.sourceRecordId ?? undefined,
        lastVerifiedAt: d.lastVerifiedAt ? new Date(d.lastVerifiedAt) : undefined,
      },
    });
    destinationIdBySlug.set(d.slug, record.id);
    console.log(`  ✓ ${d.name}`);
  }

  // Second pass: resolve and set parent links
  const withParent = destinations.filter((d) => d.parentSlug);
  if (withParent.length > 0) {
    console.log(`\nSetting ${withParent.length} parent relationships...`);
    for (const d of withParent) {
      const parentId = destinationIdBySlug.get(d.parentSlug!);
      if (!parentId) {
        console.warn(`  WARN ${d.slug}: parentSlug "${d.parentSlug}" not found — skipping parent link`);
        continue;
      }
      const childId = destinationIdBySlug.get(d.slug);
      if (!childId) continue;
      await prisma.travelDestination.update({
        where: { id: childId },
        data: { parentDestinationId: parentId },
      });
      console.log(`  ✓ ${d.name} → parent: ${d.parentSlug}`);
    }
  }

  // Upsert aliases
  console.log("\nUpserting aliases...");
  for (const d of destinations) {
    const destId = destinationIdBySlug.get(d.slug);
    if (!destId) continue;
    for (const alias of d.aliases ?? []) {
      await prisma.destinationAlias.upsert({
        where: { alias },
        create: { alias, destinationId: destId },
        update: { destinationId: destId },
      });
    }
  }

  // ── Import places ────────────────────────────────────────────────────────────
  const placesDir = path.resolve(__dirname, "master/places");
  const placeFiles = fs
    .readdirSync(placesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let totalImported = 0;
  let totalSkipped = 0;

  console.log(`\nImporting places from ${placeFiles.length} files...`);

  for (const fileName of placeFiles) {
    const filePath = path.join(placesDir, fileName);
    const raw: PlaceFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const destinationId = destinationIdBySlug.get(raw.destinationSlug);
    if (!destinationId) {
      console.warn(`  SKIP ${fileName}: destinationSlug "${raw.destinationSlug}" not found`);
      totalSkipped += raw.places.length;
      continue;
    }

    console.log(`\n  ${fileName} → ${raw.destinationSlug} (${raw.places.length} places)`);

    for (const p of raw.places) {
      try {
        await prisma.place.upsert({
          where: { slug: p.slug },
          create: {
            name: p.name,
            slug: p.slug,
            destinationId,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            description: p.description ?? null,
            area: p.area ?? null,
            address: p.address ?? null,
            costMinInr: p.costMinInr ?? null,
            costMaxInr: p.costMaxInr ?? null,
            costStatus: p.costStatus ?? "unknown",
            typicalCostInr: p.typicalCostInr ?? null,
            openingTime: p.openingTime ?? null,
            closingTime: p.closingTime ?? null,
            openingDays: p.openingDays ?? null,
            openingHoursStatus: p.openingHoursStatus ?? "unknown",
            bestSeason: p.bestSeason ?? null,
            seasonStatus: p.seasonStatus ?? "unknown",
            durationMinutes: p.durationMinutes ?? null,
            fatigueCost: p.fatigueCost ?? null,
            accessibilityScore: p.accessibilityScore ?? null,
            popularityScore: p.popularityScore ?? 50,
            hiddenGem: p.hiddenGem ?? false,
            sourceType: p.sourceType ?? "curated",
            sourceName: p.sourceName ?? null,
            sourceUrl: p.sourceUrl ?? null,
            sourceRecordId: p.sourceRecordId ?? null,
            confidence: p.confidence ?? null,
            dataStatus: p.dataStatus ?? "needs_review",
          },
          update: buildPlaceUpdatePayload(p),
        });
        console.log(`    ✓ ${p.name}`);
        totalImported++;
      } catch (e) {
        console.error(`    ✗ ${p.name}: ${(e as Error).message}`);
        totalSkipped++;
      }
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`  Destinations: ${destinations.length}`);
  console.log(`  Places imported: ${totalImported}`);
  console.log(`  Places skipped: ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error("\nImport failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
