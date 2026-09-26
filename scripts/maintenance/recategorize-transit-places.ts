/**
 * One-off repair: re-label transit infrastructure that earlier imports stored as an
 * attraction (e.g. a railway station imported as "history" because it is also a heritage
 * building). The app already hides these at query time (src/lib/transit-filter.ts); this
 * fixes the stored category so reports, admin views and future code see the truth.
 *
 *   npx tsx scripts/maintenance/recategorize-transit-places.ts           # dry run (default)
 *   npx tsx scripts/maintenance/recategorize-transit-places.ts --apply
 *
 * Only imported rows are changed. Curated/verified rows are listed for a human to review,
 * as are stays and food places whose names merely mention a station or airport
 * ("Hotel Airport View") — those are real places, just not transit ones.
 */
import { PrismaClient } from "@prisma/client";
import { isTransitPoint, TRANSIT_CATEGORY, TRANSIT_PLACE_TYPES } from "../../src/lib/transit-filter";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const PROTECTED_STATUSES = new Set(["verified", "manually_curated"]);
const NOT_AN_ATTRACTION = new Set(["stay", "restaurant", "cafe", "dining", "food"]);

async function run() {
  const places = await prisma.place.findMany({
    where: { category: { not: TRANSIT_CATEGORY } },
    select: { id: true, name: true, category: true, placeType: true, dataStatus: true, sourceType: true },
  });

  const matches = places.filter((p) => isTransitPoint(p));
  const review = matches.filter(
    (p) => p.sourceType.toLowerCase() === "curated" || PROTECTED_STATUSES.has(p.dataStatus) || NOT_AN_ATTRACTION.has(p.category),
  );
  const fix = matches.filter((p) => !review.includes(p));

  console.log(`Scanned ${places.length} non-transport places; ${matches.length} look like transit points.`);
  console.log(`\nWill recategorize (${fix.length}):`);
  for (const p of fix) console.log(`  ${p.category}/${p.placeType ?? "-"}  ${p.name}  [${p.sourceType}]`);
  console.log(`\nNeeds manual review — left unchanged (${review.length}):`);
  for (const p of review) console.log(`  ${p.category}/${p.placeType ?? "-"}  ${p.name}  [${p.sourceType}, ${p.dataStatus}]`);

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to update.");
    return;
  }

  for (const p of fix) {
    const keepType = p.placeType && (TRANSIT_PLACE_TYPES as readonly string[]).includes(p.placeType);
    await prisma.place.update({
      where: { id: p.id },
      data: { category: TRANSIT_CATEGORY, placeType: keepType ? p.placeType : "transit_hub" },
    });
  }
  console.log(`\nUpdated ${fix.length} places.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
