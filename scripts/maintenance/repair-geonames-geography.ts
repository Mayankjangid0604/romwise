import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const prisma = new PrismaClient();
const RAW_DIR = path.join(process.cwd(), "data-import", "raw");
const CITIES_FILE = path.join(RAW_DIR, "cities500.txt");

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

async function run() {
  const apply = process.argv.includes("--apply");
  console.log(`Starting GEONAMES Geography Repair. Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  if (!fs.existsSync(CITIES_FILE)) {
    console.error("cities500.txt not found. Cannot perform mapping repair without source data.");
    process.exit(1);
  }

  // Load GeoNames admin1 mapping
  const geoIdToAdmin1 = new Map<string, string>();
  const rl = readline.createInterface({
    input: fs.createReadStream(CITIES_FILE, "utf-8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim() || line.startsWith("#")) continue;
    const cols = line.split("\t");
    const geonameId = cols[0];
    const countryCode = cols[8];
    const admin1 = cols[10];
    if (countryCode === "IN") {
      geoIdToAdmin1.set(geonameId, admin1);
    }
  }

  const destinations = await prisma.travelDestination.findMany({
    where: { sourceType: "GEONAMES" }
  });

  console.log(`Found ${destinations.length} GEONAMES destinations in DB.`);

  let fixCount = 0;
  let flagCount = 0;

  for (const dest of destinations) {
    if (dest.dataStatus === "MANUALLY_CURATED") {
      continue;
    }
    if (!dest.sourceRecordId) continue;
    const admin1 = geoIdToAdmin1.get(dest.sourceRecordId);
    if (!admin1) continue;

    const correctState = STATE_MAP[admin1];
    if (!correctState) {
      flagCount++;
      continue;
    }

    if (dest.state !== correctState) {
      console.log(`Mismatch: ${dest.name} | DB state: ${dest.state} | Correct: ${correctState} (admin1: ${admin1})`);
      if (apply) {
        await prisma.travelDestination.update({
          where: { id: dest.id },
          data: { state: correctState }
        });
      }
      fixCount++;
    }
  }

  console.log(`\nRepair summary:`);
  console.log(`Total inspected: ${destinations.length}`);
  console.log(`Mismatches (fixes): ${fixCount}`);
  console.log(`Flagged (unknown admin1): ${flagCount}`);
  
  if (!apply && fixCount > 0) {
    console.log(`Run with --apply to actually update DB.`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
