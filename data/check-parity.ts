/**
 * DB ↔ Master data parity check.
 *
 * Fails (exit code 1) if the DB and the JSON master are out of sync on:
 *   - total place count
 *   - slug set (DB-only orphans or JSON-only unadded records)
 *   - destinationSlug assignment
 *
 * Run after every import: npx tsx data/check-parity.ts
 * CI usage: add to pipeline; a non-zero exit fails the build.
 *
 * This script is READ-ONLY — it never modifies the DB.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PlaceRecord {
  slug: string;
  destinationSlug: string;
}

async function main() {
  // ── Load JSON master ──────────────────────────────────────────────────────────
  const placesDir = path.resolve(__dirname, "master/places");
  const placeFiles = fs.readdirSync(placesDir).filter((f) => f.endsWith(".json"));

  const masterSlugs = new Map<string, string>(); // slug → destinationSlug
  for (const fileName of placeFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(placesDir, fileName), "utf-8"));
    for (const p of raw.places ?? []) {
      if (masterSlugs.has(p.slug)) {
        console.error(`PARITY ERROR: Duplicate slug in master JSON: "${p.slug}" (${fileName})`);
        process.exit(1);
      }
      masterSlugs.set(p.slug, raw.destinationSlug);
    }
  }

  // ── Load DB ───────────────────────────────────────────────────────────────────
  const dbPlaces = await prisma.place.findMany({
    select: {
      slug: true,
      destination: { select: { slug: true } },
    },
  });

  const dbSlugs = new Map<string, string>(); // slug → destinationSlug
  for (const p of dbPlaces) {
    dbSlugs.set(p.slug, p.destination?.slug ?? "(unknown)");
  }

  // ── Compare ───────────────────────────────────────────────────────────────────
  let failures = 0;

  // Count parity
  if (masterSlugs.size !== dbSlugs.size) {
    console.error(
      `PARITY ERROR: Count mismatch — master has ${masterSlugs.size} places, DB has ${dbSlugs.size} places`,
    );
    failures++;
  }

  // DB orphans (in DB, not in master)
  const dbOrphans: string[] = [];
  for (const [slug] of dbSlugs) {
    if (!masterSlugs.has(slug)) dbOrphans.push(slug);
  }
  if (dbOrphans.length > 0) {
    console.error(`PARITY ERROR: ${dbOrphans.length} DB orphan(s) (in DB, not in master):`);
    dbOrphans.forEach((s) => console.error(`  - ${s} (dest: ${dbSlugs.get(s)})`));
    failures++;
  }

  // Master-only (in master, not in DB)
  const masterOnly: string[] = [];
  for (const [slug] of masterSlugs) {
    if (!dbSlugs.has(slug)) masterOnly.push(slug);
  }
  if (masterOnly.length > 0) {
    console.error(`PARITY ERROR: ${masterOnly.length} master-only record(s) (in JSON, not imported):`);
    masterOnly.forEach((s) => console.error(`  - ${s} (dest: ${masterSlugs.get(s)})`));
    failures++;
  }

  // Destination assignment parity (same slug, different destinationSlug)
  const destMismatches: Array<{ slug: string; master: string; db: string }> = [];
  for (const [slug, masterDest] of masterSlugs) {
    const dbDest = dbSlugs.get(slug);
    if (dbDest && dbDest !== masterDest) {
      destMismatches.push({ slug, master: masterDest, db: dbDest });
    }
  }
  if (destMismatches.length > 0) {
    console.error(
      `PARITY ERROR: ${destMismatches.length} destination mismatch(es) (slug exists in both but assigned to different destination):`,
    );
    destMismatches.forEach((m) =>
      console.error(`  - ${m.slug}: master="${m.master}", DB="${m.db}"`),
    );
    failures++;
  }

  if (failures === 0) {
    console.log(
      `✓ DB/master parity: ${masterSlugs.size} places in sync (count, slugs, and destination assignments match)`,
    );
  }

  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("PARITY CHECK FAILED:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
