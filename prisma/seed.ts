/**
 * Seed TravelDestination records from the bundled Kaggle destinations CSV.
 *
 * Source: data/seed/destinations.csv (bundled with the project)
 * Run: npx prisma db seed  (or: npm run db:seed)
 *
 * Only rows with lat/lng are imported (city stubs without coordinates are skipped).
 * Existing records are updated via upsert-by-slug; running twice is safe.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract destination slug from destination_id.
 * Format: "dest_{slug}_{state-slug}"
 * Strip prefix and the trailing state slug.
 */
function extractSlug(destinationId: string, state: string): string {
  const stateSlug = slugify(state);
  const withoutPrefix = destinationId.replace(/^dest_/, "");
  const suffix = `_${stateSlug}`;
  if (withoutPrefix.endsWith(suffix)) {
    return withoutPrefix.slice(0, -suffix.length);
  }
  // Fallback: strip from the last underscore
  const lastUnderscore = withoutPrefix.lastIndexOf("_");
  return lastUnderscore > 0 ? withoutPrefix.slice(0, lastUnderscore) : withoutPrefix;
}

function parseDestinationType(raw: string): string | null {
  if (!raw || raw === "city") return null;
  const lower = raw.toLowerCase();
  const MAP: Record<string, string> = {
    island: "island",
    beach: "beach",
    mountain: "mountain",
    valley: "valley",
    trek: "mountain",
    village: "town",
    "national park": "national_park",
    "wildlife sanctuary": "wildlife_reserve",
    lake: "lake",
    "hill station": "hill_station",
    pilgrimage: "pilgrimage",
  };
  return MAP[lower] ?? "other";
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function main() {
  const csvPath = path.resolve(__dirname, "../data/seed/destinations.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    console.error("Ensure data/seed/destinations.csv is present in the project.");
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim());
  const rows = lines.slice(1); // skip header

  console.log(`Found ${rows.length} rows in destinations CSV`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fields = parseCsvLine(row);

    // CSV columns (0-indexed):
    // 0: destination_id, 1: name, 2: state, 3: region, 4: type,
    // 5: styles, 6: best_season, 7: latitude, 8: longitude,
    // 9: source_type, 10: data_status, 11: confidence
    const destinationId = fields[0];
    const name = fields[1];
    const state = fields[2];
    const type = fields[4];
    const bestSeason = fields[6];
    const lat = parseFloat(fields[7]);
    const lng = parseFloat(fields[8]);
    const sourceType = fields[9] || "kaggle";
    const confidence = parseFloat(fields[11]) || 0.6;

    if (!name || !state || isNaN(lat) || isNaN(lng)) {
      skipped++;
      continue;
    }

    const slug = extractSlug(destinationId, state);
    if (!slug) {
      skipped++;
      continue;
    }

    const destinationType = parseDestinationType(type);

    await prisma.travelDestination.upsert({
      where: { slug },
      create: {
        name,
        slug,
        state,
        country: "India",
        lat,
        lng,
        destinationType,
        sourceType,
        sourceRecordId: destinationId,
        confidence,
        dataStatus: "seed",
        ...(bestSeason ? { description: `Best season: ${bestSeason}` } : {}),
      },
      update: {
        lat,
        lng,
        destinationType,
        confidence,
      },
    });
    created++;
  }

  console.log(`✓ Seeded ${created} destinations (${skipped} skipped — no coordinates)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
