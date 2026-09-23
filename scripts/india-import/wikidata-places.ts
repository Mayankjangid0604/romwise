/**
 * Wikidata SPARQL Places Importer for India
 *
 * Alternative to Overpass API — queries Wikidata for notable Indian POIs
 * with coordinates, matches to nearest destination, and upserts to DB.
 *
 * Usage:
 *   npx tsx scripts/india-import/wikidata-places.ts [--dry-run] [--category CATEGORY] [--limit N]
 *   npx tsx scripts/india-import/wikidata-places.ts --category temples
 *   npx tsx scripts/india-import/wikidata-places.ts --category hotels --limit 500
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const RATE_LIMIT_MS = 2000; // Be polite to Wikidata

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function slugify(name: string, destSlug: string, sourceId: string): string {
  return `${name}-${destSlug}-${sourceId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Wikidata category definitions ----
// Each category maps to a set of Wikidata instance-of (P31) QIDs

type WikiCategory = {
  name: string;
  roamwiseCategory: string;
  placeType: string;
  qids: string[]; // Wikidata QIDs for P31 instance-of
  maxRadius: number; // km — max distance to nearest destination
};

const WIKIDATA_CATEGORIES: WikiCategory[] = [
  {
    name: "temples",
    roamwiseCategory: "spiritual",
    placeType: "temple",
    qids: ["Q44539", "Q5783996"], // temple, Hindu temple
    maxRadius: 30,
  },
  {
    name: "mosques",
    roamwiseCategory: "spiritual",
    placeType: "mosque",
    qids: ["Q32815"], // mosque
    maxRadius: 30,
  },
  {
    name: "churches",
    roamwiseCategory: "spiritual",
    placeType: "church",
    qids: ["Q16970"], // church building
    maxRadius: 30,
  },
  {
    name: "gurudwaras",
    roamwiseCategory: "spiritual",
    placeType: "gurudwara",
    qids: ["Q1550786"], // gurdwara
    maxRadius: 30,
  },
  {
    name: "forts",
    roamwiseCategory: "history",
    placeType: "fort",
    qids: ["Q57821", "Q1785071"], // fortification, fort in India
    maxRadius: 40,
  },
  {
    name: "palaces",
    roamwiseCategory: "history",
    placeType: "palace",
    qids: ["Q16560"], // palace
    maxRadius: 30,
  },
  {
    name: "museums",
    roamwiseCategory: "culture",
    placeType: "museum",
    qids: ["Q33506", "Q207694"], // museum, art museum
    maxRadius: 30,
  },
  {
    name: "monuments",
    roamwiseCategory: "history",
    placeType: "monument",
    qids: ["Q4989906", "Q570116"], // monument, heritage building
    maxRadius: 30,
  },
  {
    name: "parks",
    roamwiseCategory: "nature",
    placeType: "national_park",
    qids: ["Q46169", "Q2065736"], // national park, wildlife sanctuary
    maxRadius: 60,
  },
  {
    name: "lakes",
    roamwiseCategory: "nature",
    placeType: "lake",
    qids: ["Q23397"], // lake
    maxRadius: 40,
  },
  {
    name: "waterfalls",
    roamwiseCategory: "nature",
    placeType: "waterfall",
    qids: ["Q34038"], // waterfall
    maxRadius: 50,
  },
  {
    name: "beaches",
    roamwiseCategory: "nature",
    placeType: "beach",
    qids: ["Q40080"], // beach
    maxRadius: 30,
  },
  {
    name: "caves",
    roamwiseCategory: "nature",
    placeType: "cave",
    qids: ["Q35509"], // cave
    maxRadius: 50,
  },
  {
    name: "airports",
    roamwiseCategory: "transport",
    placeType: "airport",
    qids: ["Q1248784", "Q94993988"], // airport, commercial airport
    maxRadius: 50,
  },
  {
    name: "railway_stations",
    roamwiseCategory: "transport",
    placeType: "railway_station",
    qids: ["Q55488"], // railway station
    maxRadius: 20,
  },
  {
    name: "hotels",
    roamwiseCategory: "stay",
    placeType: "hotel",
    qids: ["Q27686"], // hotel
    maxRadius: 20,
  },
  {
    name: "botanical_gardens",
    roamwiseCategory: "nature",
    placeType: "garden",
    qids: ["Q167346"], // botanical garden
    maxRadius: 30,
  },
  {
    name: "zoos",
    roamwiseCategory: "family",
    placeType: "zoo",
    qids: ["Q43501"], // zoo
    maxRadius: 30,
  },
  {
    name: "viewpoints",
    roamwiseCategory: "sightseeing",
    placeType: "viewpoint",
    qids: ["Q180516"], // bridge (scenic bridges)
    maxRadius: 30,
  },
  {
    name: "archaeological",
    roamwiseCategory: "history",
    placeType: "archaeological_site",
    qids: ["Q839954"], // archaeological site
    maxRadius: 50,
  },
  {
    name: "world_heritage",
    roamwiseCategory: "sightseeing",
    placeType: "world_heritage_site",
    qids: ["Q9259"], // World Heritage Site
    maxRadius: 60,
  },
];

async function sparqlQuery(query: string): Promise<any> {
  const url = new URL(WIKIDATA_SPARQL);
  url.searchParams.set("query", query);
  const resp = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Roamwise/1.0 (travel data import; contact: dev@roamwise.app)",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wikidata SPARQL error ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}

function buildSparqlQuery(cat: WikiCategory, offset: number = 0, batchSize: number = 2000): string {
  const qidValues = cat.qids.map(q => `wd:${q}`).join(" ");
  return `
    SELECT ?place ?placeLabel ?lat ?lon ?wikidataId ?image ?description WHERE {
      ?place wdt:P17 wd:Q668.
      ?place wdt:P625 ?coord.
      ?place wdt:P31 ?instance.
      VALUES ?instance { ${qidValues} }
      BIND(geof:latitude(?coord) AS ?lat)
      BIND(geof:longitude(?coord) AS ?lon)
      BIND(STRAFTER(STR(?place), "entity/") AS ?wikidataId)
      OPTIONAL { ?place wdt:P18 ?image. }
      OPTIONAL { ?place schema:description ?description. FILTER(LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hi". }
    }
    ORDER BY ?placeLabel
    LIMIT ${batchSize}
    OFFSET ${offset}
  `;
}

// Load all destinations into memory for nearest-match
type DestRef = { id: string; name: string; slug: string; lat: number; lng: number; state: string };

function findNearestDestination(lat: number, lon: number, destinations: DestRef[], maxRadius: number): DestRef | null {
  let best: DestRef | null = null;
  let bestDist = Infinity;
  for (const d of destinations) {
    const dist = haversine(lat, lon, d.lat, d.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return bestDist <= maxRadius ? best : null;
}

async function importCategory(
  cat: WikiCategory,
  destinations: DestRef[],
  dryRun: boolean,
  limit: number,
): Promise<{ inserted: number; updated: number; skipped: number; scanned: number }> {
  let inserted = 0, updated = 0, skipped = 0, scanned = 0;
  let offset = 0;
  const batchSize = 2000;

  while (true) {
    const query = buildSparqlQuery(cat, offset, batchSize);
    console.log(`  [sparql] ${cat.name} offset=${offset}...`);

    let data: any;
    try {
      data = await sparqlQuery(query);
    } catch (err: any) {
      console.error(`  [error] ${cat.name}: ${err.message}`);
      break;
    }

    const bindings = data?.results?.bindings ?? [];
    if (bindings.length === 0) break;

    console.log(`  [found] ${bindings.length} results for ${cat.name}`);

    for (const b of bindings) {
      if (limit > 0 && inserted >= limit) break;
      scanned++;

      const name = b.placeLabel?.value;
      const lat = parseFloat(b.lat?.value);
      const lon = parseFloat(b.lon?.value);
      const wikidataId = b.wikidataId?.value;
      const imageUrl = b.image?.value;
      const description = b.description?.value;

      if (!name || isNaN(lat) || isNaN(lon) || !wikidataId) {
        skipped++;
        continue;
      }

      // Skip if name looks like a QID (unlabeled entity)
      if (name.startsWith("Q") && /^Q\d+$/.test(name)) {
        skipped++;
        continue;
      }

      // Find nearest destination
      const dest = findNearestDestination(lat, lon, destinations, cat.maxRadius);
      if (!dest) {
        skipped++; // Too far from any destination
        continue;
      }

      const sourceId = wikidataId;
      const slug = slugify(name, dest.slug, sourceId);

      if (dryRun) {
        inserted++;
        continue;
      }

      try {
        // Check existing
        const existing = await prisma.place.findFirst({
          where: { sourceType: "WIKIDATA", sourceRecordId: sourceId },
          select: { id: true, dataStatus: true },
        });

        if (existing && (existing.dataStatus === "verified" || existing.dataStatus === "manually_curated")) {
          skipped++;
          continue;
        }

        const placeData = {
          name,
          lat, lng: lon,
          category: cat.roamwiseCategory,
          placeType: cat.placeType,
          description: description || null,
          popularityScore: 75, // Notable Wikidata entities get higher base score
          sourceType: "WIKIDATA" as const,
          sourceRecordId: sourceId,
          sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
          sourceName: "Wikidata",
          dataStatus: "imported" as const,
          confidence: 0.85, // Wikidata is high quality
        };

        if (existing) {
          await prisma.place.update({
            where: { id: existing.id },
            data: { ...placeData, updatedAt: new Date() },
          });
          updated++;
        } else {
          const newPlace = await prisma.place.create({
            data: { ...placeData, slug, destinationId: dest.id },
          });
          // Create related Image if Wikidata provided one
          if (imageUrl && newPlace.id) {
            await prisma.image.create({
              data: { url: imageUrl, altText: name, placeId: newPlace.id, source: "wikidata" },
            }).catch(() => {}); // Non-critical
          }
          inserted++;
        }
      } catch (err: any) {
        if (err.code === "P2002") {
          // Duplicate slug — retry with timestamp suffix
          try {
            await prisma.place.create({
              data: {
                name, slug: `${slug}-${Date.now().toString(36)}`,
                destinationId: dest.id,
                lat, lng: lon,
                category: cat.roamwiseCategory,
                placeType: cat.placeType,
                description: description || null,
                popularityScore: 75,
                sourceType: "WIKIDATA", sourceRecordId: sourceId,
                sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
                sourceName: "Wikidata", dataStatus: "imported", confidence: 0.85,
              },
            });
            inserted++;
          } catch {
            skipped++;
          }
        } else {
          console.error(`  [error] ${name}: ${err.message}`);
          skipped++;
        }
      }
    }

    if (bindings.length < batchSize) break;
    if (limit > 0 && inserted >= limit) break;
    offset += batchSize;
    await sleep(RATE_LIMIT_MS);
  }

  return { inserted, updated, skipped, scanned };
}

// --- Main ---
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const catFilter = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

async function main() {
  console.log("=== Wikidata India Places Import ===\n");
  console.log(`Dry run: ${dryRun}`);
  if (catFilter) console.log(`Category filter: ${catFilter}`);
  if (limit > 0) console.log(`Limit per category: ${limit}`);

  // Register Wikidata data source
  if (!dryRun) {
    await prisma.dataSource.upsert({
      where: { name: "Wikidata" },
      create: {
        name: "Wikidata",
        type: "api",
        url: "https://query.wikidata.org/sparql",
        license: "CC0 1.0",
        attribution: "Wikidata contributors",
        notes: "Notable POI data via SPARQL endpoint",
        accessedAt: new Date(),
      },
      update: { accessedAt: new Date() },
    });
  }

  // Load all destinations
  const destinations = await prisma.travelDestination.findMany({
    select: { id: true, name: true, slug: true, lat: true, lng: true, state: true },
  });
  console.log(`Loaded ${destinations.length} destinations for matching\n`);

  // Filter categories
  const cats = catFilter
    ? WIKIDATA_CATEGORIES.filter(c => c.name === catFilter)
    : WIKIDATA_CATEGORIES;

  if (cats.length === 0) {
    console.error(`Unknown category: ${catFilter}`);
    console.log(`Available: ${WIKIDATA_CATEGORIES.map(c => c.name).join(", ")}`);
    return;
  }

  // Create import batch
  const batch = !dryRun ? await prisma.importBatch.create({
    data: { source: "WIKIDATA", status: "running", scanned: 0 },
  }) : null;

  let grandInserted = 0, grandUpdated = 0, grandSkipped = 0, grandScanned = 0;

  for (const cat of cats) {
    console.log(`\n--- ${cat.name} (${cat.roamwiseCategory}/${cat.placeType}) ---`);
    const result = await importCategory(cat, destinations, dryRun, limit);
    console.log(`  → inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped} scanned=${result.scanned}`);

    grandInserted += result.inserted;
    grandUpdated += result.updated;
    grandSkipped += result.skipped;
    grandScanned += result.scanned;

    await sleep(RATE_LIMIT_MS);
  }

  // Finalize batch
  if (batch) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        scanned: grandScanned,
        inserted: grandInserted,
        updated: grandUpdated,
        skipped: grandSkipped,
      },
    });
  }

  console.log("\n=== Final Results ===");
  console.log(`Scanned: ${grandScanned}`);
  console.log(`Inserted: ${grandInserted}`);
  console.log(`Updated: ${grandUpdated}`);
  console.log(`Skipped: ${grandSkipped}`);
  if (dryRun) console.log("\n[DRY RUN] No database changes were made.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
