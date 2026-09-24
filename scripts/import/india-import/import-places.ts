/**
 * Overpass API Places Importer for India
 *
 * Queries Overpass API for POIs within each destination's bounding box.
 * Imports attractions, food, stays, transport nodes.
 *
 * Usage:
 *   npx tsx scripts/india-import/import-places.ts [--dry-run] [--destination NAME] [--limit N] [--categories LIST]
 *   npx tsx scripts/india-import/import-places.ts --destination Jaipur
 *   npx tsx scripts/india-import/import-places.ts --categories stays,food
 */

import { PrismaClient } from "@prisma/client";
import { mapOsmTags, computeQualityScore, parseSimpleHours } from "./osm-tag-mapping";

const prisma = new PrismaClient();

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const RATE_LIMIT_MS = 2500; // 2.5s between queries per Overpass fair use

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function slugify(name: string, destSlug: string, sourceId: string): string {
  const base = `${name}-${destSlug}-${sourceId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
  return base;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

async function queryOverpass(query: string): Promise<OverpassResponse> {
  const resp = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Overpass error ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// Build Overpass queries for different POI types
function buildAttractionQuery(bbox: string): string {
  return `[out:json][timeout:60];
(
  node["tourism"~"attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park"](${bbox});
  way["tourism"~"attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park"](${bbox});
  node["historic"~"fort|castle|palace|monument|memorial|ruins|archaeological_site|city_gate"](${bbox});
  way["historic"~"fort|castle|palace|monument|memorial|ruins|archaeological_site|city_gate"](${bbox});
  node["natural"~"beach|peak|waterfall|cave_entrance|hot_spring"](${bbox});
  way["natural"~"beach|peak|waterfall|cave_entrance|hot_spring"](${bbox});
  node["leisure"~"park|garden|nature_reserve"](${bbox});
  way["leisure"~"park|garden|nature_reserve"](${bbox});
  node["amenity"="place_of_worship"]["name"](${bbox});
  way["amenity"="place_of_worship"]["name"](${bbox});
  node["amenity"="marketplace"]["name"](${bbox});
  node["shop"="mall"]["name"](${bbox});
  way["shop"="mall"]["name"](${bbox});
);
out center tags;`;
}

function buildFoodQuery(bbox: string): string {
  return `[out:json][timeout:60];
(
  node["amenity"~"restaurant|cafe|food_court"]["name"](${bbox});
  way["amenity"~"restaurant|cafe|food_court"]["name"](${bbox});
);
out center tags;`;
}

function buildStayQuery(bbox: string): string {
  return `[out:json][timeout:60];
(
  node["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|resort"]["name"](${bbox});
  way["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|resort"]["name"](${bbox});
);
out center tags;`;
}

function buildTransportQuery(bbox: string): string {
  return `[out:json][timeout:60];
(
  node["aeroway"="aerodrome"]["name"](${bbox});
  way["aeroway"="aerodrome"]["name"](${bbox});
  node["railway"="station"]["name"](${bbox});
  way["railway"="station"]["name"](${bbox});
  node["amenity"="bus_station"]["name"](${bbox});
  way["amenity"="bus_station"]["name"](${bbox});
);
out center tags;`;
}

function getBbox(lat: number, lng: number, radiusKm: number = 15): string {
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
  return `${(lat - latDelta).toFixed(4)},${(lng - lngDelta).toFixed(4)},${(lat + latDelta).toFixed(4)},${(lng + lngDelta).toFixed(4)}`;
}

type CategoryGroup = "attractions" | "food" | "stays" | "transport";

const QUERY_BUILDERS: Record<CategoryGroup, (bbox: string) => string> = {
  attractions: buildAttractionQuery,
  food: buildFoodQuery,
  stays: buildStayQuery,
  transport: buildTransportQuery,
};

async function importPlacesForDestination(
  dest: { id: string; name: string; slug: string; lat: number; lng: number; state: string },
  categories: CategoryGroup[],
  dryRun: boolean,
  batchId: string | null,
): Promise<{ inserted: number; updated: number; skipped: number; scanned: number }> {
  const bbox = getBbox(dest.lat, dest.lng);
  let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, totalScanned = 0;

  for (const cat of categories) {
    const query = QUERY_BUILDERS[cat](bbox);
    console.log(`    [overpass] ${dest.name} → ${cat}...`);

    let data: OverpassResponse;
    try {
      data = await queryOverpass(query);
    } catch (err: any) {
      console.error(`    [error] ${dest.name}/${cat}: ${err.message}`);
      await sleep(RATE_LIMIT_MS * 2);
      continue;
    }

    const elements = data.elements.filter(e => e.tags?.name);
    totalScanned += elements.length;
    console.log(`    [found] ${elements.length} named ${cat} in ${dest.name}`);

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name!;

      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!lat || !lng) { totalSkipped++; continue; }

      const mapping = mapOsmTags(tags);
      if (!mapping) { totalSkipped++; continue; }

      const sourceId = `${el.type}:${el.id}`;
      const slug = slugify(name, dest.slug, sourceId);

      // Parse opening hours
      const rawHours = tags.opening_hours;
      const parsedHours = parseSimpleHours(rawHours);

      // Extract address parts
      const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
        .filter(Boolean).join(", ") || undefined;

      // Extract locality/area
      const area = tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:city_district"] || undefined;

      // Stars for hotels
      const stars = tags.stars ? parseInt(tags.stars, 10) : undefined;

      const quality = computeQualityScore({
        name, lat, lng, destinationId: dest.id, category: mapping.category,
        area, address, website: tags.website, openingHours: rawHours, wheelchair: tags.wheelchair,
      });

      if (dryRun) {
        totalInserted++;
        continue;
      }

      try {
        // Check if this exact source record exists
        const existing = await prisma.place.findFirst({
          where: { sourceType: "OPENSTREETMAP", sourceRecordId: sourceId },
          select: { id: true, dataStatus: true },
        });

        // Don't overwrite manually verified records
        if (existing && (existing.dataStatus === "verified" || existing.dataStatus === "manually_curated")) {
          totalSkipped++;
          continue;
        }

        if (existing) {
          // Update existing
          await prisma.place.update({
            where: { id: existing.id },
            data: {
              name,
              lat, lng,
              category: mapping.category,
              placeType: mapping.placeType,
              area: area ?? undefined,
              address: address ?? undefined,
              website: tags.website ?? undefined,
              phone: tags.phone ?? tags["contact:phone"] ?? undefined,
              cuisine: tags.cuisine ?? undefined,
              wheelchair: tags.wheelchair ?? undefined,
              osmRawHours: rawHours ?? undefined,
              openingTime: parsedHours?.openingTime ?? undefined,
              closingTime: parsedHours?.closingTime ?? undefined,
              stars: stars && !isNaN(stars) ? stars : undefined,
              popularityScore: quality,
              updatedAt: new Date(),
            },
          });
          totalUpdated++;
        } else {
          // Insert new
          await prisma.place.create({
            data: {
              name,
              slug,
              destinationId: dest.id,
              category: mapping.category,
              lat, lng,
              placeType: mapping.placeType,
              area,
              address,
              website: tags.website,
              phone: tags.phone || tags["contact:phone"],
              cuisine: tags.cuisine,
              wheelchair: tags.wheelchair,
              osmRawHours: rawHours,
              openingTime: parsedHours?.openingTime,
              closingTime: parsedHours?.closingTime,
              stars: stars && !isNaN(stars) ? stars : null,
              popularityScore: quality,
              sourceType: "OPENSTREETMAP",
              sourceRecordId: sourceId,
              sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
              sourceName: "OpenStreetMap",
              dataStatus: "imported",
              confidence: 0.7,
            },
          });
          totalInserted++;
        }
      } catch (err: any) {
        if (err.code === "P2002") {
          // Duplicate slug — append extra unique suffix
          try {
            await prisma.place.create({
              data: {
                name,
                slug: `${slug}-${Date.now().toString(36)}`,
                destinationId: dest.id,
                category: mapping.category,
                lat, lng,
                placeType: mapping.placeType,
                area, address,
                website: tags.website, phone: tags.phone || tags["contact:phone"],
                cuisine: tags.cuisine, wheelchair: tags.wheelchair,
                osmRawHours: rawHours,
                openingTime: parsedHours?.openingTime, closingTime: parsedHours?.closingTime,
                stars: stars && !isNaN(stars) ? stars : null,
                popularityScore: quality,
                sourceType: "OPENSTREETMAP", sourceRecordId: sourceId,
                sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
                sourceName: "OpenStreetMap", dataStatus: "imported", confidence: 0.7,
              },
            });
            totalInserted++;
          } catch {
            totalSkipped++;
          }
        } else {
          console.error(`    [error] ${name}: ${err.message}`);
          totalSkipped++;
        }
      }
    }

    await sleep(RATE_LIMIT_MS);
  }

  return { inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, scanned: totalScanned };
}

// --- Main ---
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const destFilter = args.includes("--destination") ? args[args.indexOf("--destination") + 1] : null;
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const catIdx = args.indexOf("--categories");
const catFilter: CategoryGroup[] = catIdx >= 0 ? args[catIdx + 1].split(",").filter((c): c is CategoryGroup => ["attractions", "food", "stays", "transport"].includes(c)) : ["attractions", "food", "stays", "transport"];

// Priority destinations that get processed first
const PRIORITY_DESTINATIONS = [
  "Jaipur", "Delhi", "Mumbai", "Agra", "Goa", "Udaipur", "Jodhpur", "Jaisalmer",
  "Varanasi", "Rishikesh", "Shimla", "Manali", "Dharamshala", "Srinagar",
  "Amritsar", "Kolkata", "Darjeeling", "Gangtok", "Shillong",
  "Hyderabad", "Bengaluru", "Mysuru", "Chennai", "Kochi",
  "Munnar", "Alappuzha", "Thiruvananthapuram",
  "Bhubaneswar", "Pune", "Ahmedabad", "Lucknow", "Bhopal", "Indore",
  "Chandigarh", "Dehradun", "Haridwar", "Guwahati",
  "Hampi", "Gokarna", "Kodaikanal", "Ooty", "Pondicherry",
  "Madurai", "Coimbatore", "Jaipur", "Khajuraho",
];

async function main() {
  console.log("=== Overpass India Places Import ===\n");
  console.log(`Dry run: ${dryRun}`);
  console.log(`Categories: ${catFilter.join(", ")}`);
  if (destFilter) console.log(`Destination filter: ${destFilter}`);

  // Register OSM data source
  if (!dryRun) {
    await prisma.dataSource.upsert({
      where: { name: "OpenStreetMap" },
      create: {
        name: "OpenStreetMap",
        type: "api",
        url: "https://overpass-api.de/api/interpreter",
        license: "ODbL 1.0",
        attribution: "© OpenStreetMap contributors",
        notes: "POI data via Overpass API, filtered by travel categories",
        accessedAt: new Date(),
      },
      update: { accessedAt: new Date() },
    });
  }

  // Get destinations to process
  let destinations = await prisma.travelDestination.findMany({
    where: destFilter ? { name: { equals: destFilter, mode: "insensitive" } } : {},
    select: { id: true, name: true, slug: true, lat: true, lng: true, state: true },
    orderBy: { name: "asc" },
  });

  if (destFilter && destinations.length === 0) {
    console.error(`Destination "${destFilter}" not found.`);
    return;
  }

  // Sort: priority destinations first
  const prioritySet = new Set(PRIORITY_DESTINATIONS.map(n => n.toLowerCase()));
  destinations.sort((a, b) => {
    const aP = prioritySet.has(a.name.toLowerCase()) ? 0 : 1;
    const bP = prioritySet.has(b.name.toLowerCase()) ? 0 : 1;
    return aP - bP || a.name.localeCompare(b.name);
  });

  if (limit > 0) destinations = destinations.slice(0, limit);
  console.log(`Processing ${destinations.length} destinations\n`);

  // Create import batch
  const batch = !dryRun ? await prisma.importBatch.create({
    data: { source: "OPENSTREETMAP", status: "running", scanned: 0 },
  }) : null;

  let grandInserted = 0, grandUpdated = 0, grandSkipped = 0, grandScanned = 0;

  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    console.log(`  [${i + 1}/${destinations.length}] ${dest.name} (${dest.state})`);

    const result = await importPlacesForDestination(dest, catFilter, dryRun, batch?.id || null);
    grandInserted += result.inserted;
    grandUpdated += result.updated;
    grandSkipped += result.skipped;
    grandScanned += result.scanned;

    console.log(`    → inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}\n`);

    // Update batch progress periodically
    if (batch && i % 10 === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { scanned: grandScanned, inserted: grandInserted, updated: grandUpdated, skipped: grandSkipped },
      });
    }
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

  console.log("=== Final Results ===");
  console.log(`Scanned: ${grandScanned}`);
  console.log(`Inserted: ${grandInserted}`);
  console.log(`Updated: ${grandUpdated}`);
  console.log(`Skipped: ${grandSkipped}`);
  if (dryRun) console.log("\n[DRY RUN] No database changes were made.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
