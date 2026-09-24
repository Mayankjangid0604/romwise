/**
 * GeoNames India Destinations Importer
 *
 * Downloads GeoNames cities500.txt and imports Indian cities/towns
 * as TravelDestination records. Idempotent via slug-based upsert.
 *
 * Usage: npx tsx scripts/india-import/import-destinations.ts [--dry-run] [--min-pop N]
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as https from "https";
import * as http from "http";
import { createGunzip } from "zlib";

const prisma = new PrismaClient();

const RAW_DIR = path.join(process.cwd(), "data-import", "raw");
const CITIES_FILE = path.join(RAW_DIR, "cities500.txt");
const ALT_NAMES_FILE = path.join(RAW_DIR, "alternateNames.txt");

// Indian state codes → state names (GeoNames uses FIPS codes for admin1)
const STATE_MAP: Record<string, string> = {
  "01": "Andaman and Nicobar Islands", "02": "Andhra Pradesh", "03": "Assam",
  "34": "Bihar", "05": "Chandigarh", "37": "Chhattisgarh", "07": "Delhi",
  "52": "Dadra and Nagar Haveli and Daman and Diu", "33": "Goa", "09": "Gujarat",
  "10": "Haryana", "11": "Himachal Pradesh", "12": "Jammu and Kashmir",
  "38": "Jharkhand", "19": "Karnataka", "13": "Kerala", "14": "Lakshadweep",
  "35": "Madhya Pradesh", "16": "Maharashtra", "17": "Manipur",
  "18": "Meghalaya", "31": "Mizoram", "20": "Nagaland", "21": "Odisha",
  "22": "Puducherry", "23": "Punjab", "24": "Rajasthan", "29": "Sikkim",
  "25": "Tamil Nadu", "26": "Tripura", "36": "Uttar Pradesh",
  "39": "Uttarakhand", "28": "West Bengal", "40": "Telangana",
  "41": "Ladakh", "30": "Arunachal Pradesh",
};

function slugify(name: string, state: string): string {
  const base = `${name}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base;
}

/** Download a file from URL to destination path */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  [skip] ${path.basename(dest)} already downloaded`);
      return resolve();
    }
    console.log(`  [download] ${url} → ${path.basename(dest)}`);
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
      }
      const stream = url.endsWith(".gz") ? response.pipe(createGunzip()) : response;
      stream.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

interface GeoCity {
  geonameId: string;
  name: string;
  lat: number;
  lng: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1: string;
  population: number;
}

async function parseGeoNamesCities(minPop: number): Promise<GeoCity[]> {
  await downloadFile(
    "https://download.geonames.org/export/dump/cities500.zip",
    path.join(RAW_DIR, "cities500.zip")
  );

  // Unzip if needed
  if (!fs.existsSync(CITIES_FILE)) {
    console.log("  [unzip] cities500.zip");
    const { execSync } = await import("child_process");
    execSync(`unzip -o ${path.join(RAW_DIR, "cities500.zip")} -d ${RAW_DIR}`);
  }

  const cities: GeoCity[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(CITIES_FILE, "utf-8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parts = line.split("\t");
    if (parts.length < 19) continue;
    const countryCode = parts[8];
    if (countryCode !== "IN") continue;

    const pop = parseInt(parts[14], 10) || 0;
    if (pop < minPop) continue;

    const featureClass = parts[6];
    const featureCode = parts[7];
    // Only populated places
    if (featureClass !== "P") continue;

    cities.push({
      geonameId: parts[0],
      name: parts[1],
      lat: parseFloat(parts[4]),
      lng: parseFloat(parts[5]),
      featureClass,
      featureCode,
      countryCode,
      admin1: parts[10],
      population: pop,
    });
  }

  return cities;
}

/** Known tourism destinations that should always be included regardless of population */
const MUST_INCLUDE = new Set([
  "Hampi", "Gokarna", "Kasol", "McLeod Ganj", "Dalhousie", "Mawlynnong",
  "Dawki", "Sohra", "Palolem", "Vagator", "Anjuna", "Candolim", "Calangute",
  "Baga", "Varkala", "Alappuzha", "Thekkady", "Munnar", "Wayanad",
  "Coorg", "Chikmagalur", "Kodaikanal", "Ooty", "Mahabalipuram",
  "Rameswaram", "Konark", "Orchha", "Khajuraho", "Lonavala",
  "Mahabaleshwar", "Kevadia", "Auli", "Joshimath", "Badrinath",
  "Kedarnath", "Sonamarg", "Gulmarg", "Pahalgam", "Pangong",
  "Nubra Valley", "Ziro", "Tawang", "Spiti", "Kaza",
]);

async function importDestinations(dryRun: boolean, minPop: number) {
  console.log("\n=== GeoNames India Destinations Import ===\n");
  console.log(`  Min population: ${minPop}`);
  console.log(`  Dry run: ${dryRun}`);

  const cities = await parseGeoNamesCities(minPop);
  console.log(`  GeoNames Indian cities found (pop >= ${minPop}): ${cities.length}`);

  // Register data source
  if (!dryRun) {
    await prisma.dataSource.upsert({
      where: { name: "GeoNames" },
      create: {
        name: "GeoNames",
        type: "download",
        url: "https://download.geonames.org/export/dump/",
        license: "CC BY 4.0",
        attribution: "GeoNames.org",
        notes: "Indian cities from cities500.txt",
        accessedAt: new Date(),
      },
      update: { accessedAt: new Date() },
    });
  }

  // Get existing destinations to avoid overwriting manually curated ones
  const existing = await prisma.travelDestination.findMany({
    select: { slug: true, sourceType: true, dataStatus: true },
  });
  const existingSlugs = new Map(existing.map(d => [d.slug, d]));

  let inserted = 0, updated = 0, skipped = 0;

  // Create import batch
  const batch = !dryRun ? await prisma.importBatch.create({
    data: { source: "GEONAMES", sourceFile: "cities500.txt", status: "running", scanned: cities.length },
  }) : null;

  for (const city of cities) {
    const state = STATE_MAP[city.admin1] || city.admin1;
    const slug = slugify(city.name, state);

    const existingRecord = existingSlugs.get(slug);

    // Don't overwrite manually curated destinations
    if (existingRecord && (existingRecord.sourceType === "curated" || existingRecord.dataStatus === "verified")) {
      skipped++;
      continue;
    }

    if (dryRun) {
      inserted++;
      continue;
    }

    try {
      await prisma.travelDestination.upsert({
        where: { slug },
        create: {
          name: city.name,
          slug,
          state,
          country: "India",
          lat: city.lat,
          lng: city.lng,
          sourceType: "GEONAMES",
          sourceRecordId: city.geonameId,
          sourceUrl: `https://www.geonames.org/${city.geonameId}`,
          dataStatus: "imported",
          confidence: 0.8,
          destinationType: city.featureCode === "PPLC" ? "capital" : "city",
        },
        update: {
          lat: city.lat,
          lng: city.lng,
          sourceType: "GEONAMES",
          sourceRecordId: city.geonameId,
        },
      });
      if (existingRecord) updated++;
      else inserted++;
    } catch (err: any) {
      if (err.code === "P2002") {
        skipped++;
      } else {
        console.error(`  [error] ${city.name}: ${err.message}`);
      }
    }
  }

  // Update batch
  if (batch) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "completed", completedAt: new Date(), inserted, updated, skipped },
    });
  }

  console.log(`\n  Results: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped, scanned: cities.length };
}

async function importAliases(dryRun: boolean) {
  console.log("\n=== GeoNames Destination Aliases Import ===\n");

  // Get all destinations with GeoNames source IDs
  const destinations = await prisma.travelDestination.findMany({
    where: { sourceType: "GEONAMES", sourceRecordId: { not: null } },
    select: { id: true, name: true, sourceRecordId: true },
  });

  const geonameIdToDestId = new Map<string, { id: string; name: string }>();
  for (const d of destinations) {
    if (d.sourceRecordId) geonameIdToDestId.set(d.sourceRecordId, { id: d.id, name: d.name });
  }
  console.log(`  Destinations with GeoNames IDs: ${geonameIdToDestId.size}`);

  // Also get existing manually curated destinations for alias enrichment
  const allDests = await prisma.travelDestination.findMany({
    select: { id: true, name: true, slug: true },
  });

  // Well-known Indian city aliases (from GeoNames alternate names + common knowledge)
  const KNOWN_ALIASES: Record<string, string[]> = {
    "Bengaluru": ["Bangalore"],
    "Mumbai": ["Bombay"],
    "Kolkata": ["Calcutta"],
    "Chennai": ["Madras"],
    "Kochi": ["Cochin"],
    "Mysuru": ["Mysore"],
    "Varanasi": ["Banaras", "Benares", "Kashi"],
    "Puducherry": ["Pondicherry"],
    "Prayagraj": ["Allahabad"],
    "Gurugram": ["Gurgaon"],
    "Thiruvananthapuram": ["Trivandrum"],
    "Visakhapatnam": ["Vizag"],
    "Coimbatore": ["Kovai"],
    "Kozhikode": ["Calicut"],
    "Thrissur": ["Trichur"],
    "Shimla": ["Simla"],
    "Sohra": ["Cherrapunji", "Cherrapunjee"],
    "Alappuzha": ["Alleppey"],
    "Madurai": ["Thoonga Nagaram"],
    "New Delhi": ["Delhi NCR"],
  };

  let inserted = 0, skipped = 0;

  // Get existing aliases to avoid duplicates
  const existingAliases = await prisma.destinationAlias.findMany({ select: { alias: true } });
  const existingAliasSet = new Set(existingAliases.map(a => a.alias.toLowerCase()));

  for (const dest of allDests) {
    const aliases = KNOWN_ALIASES[dest.name] || [];
    for (const alias of aliases) {
      if (existingAliasSet.has(alias.toLowerCase())) {
        skipped++;
        continue;
      }
      if (!dryRun) {
        try {
          await prisma.destinationAlias.create({
            data: { alias, destinationId: dest.id },
          });
          inserted++;
          existingAliasSet.add(alias.toLowerCase());
        } catch {
          skipped++;
        }
      } else {
        inserted++;
      }
    }
  }

  console.log(`  Aliases: inserted=${inserted} skipped=${skipped}`);
  return { inserted, skipped };
}

// --- Main ---
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const minPopIdx = args.indexOf("--min-pop");
const minPop = minPopIdx >= 0 ? parseInt(args[minPopIdx + 1], 10) : 5000;

async function main() {
  try {
    const destResult = await importDestinations(dryRun, minPop);
    const aliasResult = await importAliases(dryRun);

    console.log("\n=== Summary ===");
    console.log(`Destinations: inserted=${destResult.inserted} updated=${destResult.updated}`);
    console.log(`Aliases: inserted=${aliasResult.inserted}`);

    if (dryRun) console.log("\n[DRY RUN] No database changes were made.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
