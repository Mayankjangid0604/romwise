import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function slugify(name: string, state: string): string {
  return `${name}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

async function main() {
  const csvPath = path.resolve(__dirname, "../../india-districts/out/all_districts.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    console.error("Run the india-districts data pipeline first.");
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.log(`CSV not found at ${csvPath}`);
    console.log(`Skipping district seeding. To seed districts, run the india-districts data pipeline first.`);
    return;
  }
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim());
  // const header = lines[0];
  const rows = lines.slice(1);

  console.log(`Found ${rows.length} districts to seed`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fields = parseCsvLine(row);
    const name = fields[0]?.trim();
    const state = fields[1]?.trim();
    const lat = parseFloat(fields[3]);
    const lng = parseFloat(fields[4]);
    const population = fields[5] ? parseInt(fields[5], 10) : null;

    if (!name || !state || isNaN(lat) || isNaN(lng)) {
      skipped++;
      continue;
    }

    const slug = slugify(name, state);

    await prisma.district.upsert({
      where: { slug },
      create: {
        name,
        slug,
        state,
        lat,
        lng,
        population: isNaN(population ?? NaN) ? null : population,
      },
      update: {
        lat,
        lng,
        population: isNaN(population ?? NaN) ? null : population,
      },
    });
    created++;
  }

  console.log(`Seeded ${created} destinations (${skipped} skipped)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
