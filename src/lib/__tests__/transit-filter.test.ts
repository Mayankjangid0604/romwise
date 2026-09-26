/**
 * Regression tests: transit infrastructure (railway/metro stations, bus stands, airports,
 * ferry terminals) must never be offered as a place to visit.
 *
 * The original bug had three layers, each covered here:
 *  1. Import — stations were stored as "history"/"sightseeing": a Wikidata pass for
 *     heritage sites overwrote the earlier "transport" pass, and the OSM mapping only knew
 *     railway=station / aerodrome / bus_station, so halts, metro stations, bus stops and a
 *     "bus stand" tagged tourism=attraction fell through. → importer mapping tests.
 *  2. Retrieval — itinerary candidates and the other place lists only excluded
 *     `category: "transport"`, so a mislabelled station went straight through.
 *     → the SQL filter must agree with the in-memory rule, getCandidatePlaces must drop it,
 *       and every place listing must apply the filter (static guard).
 *  3. Data — curated master data must not quietly gain stations. → invariant on data/master.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  prisma: {
    place: { findMany: vi.fn(), findUnique: vi.fn() },
    travelDestination: { findMany: vi.fn() },
  },
}));

import {
  isTransitName,
  isTransitPoint,
  NOT_TRANSIT_WHERE,
  resolveImportedCategory,
  TRANSIT_CATEGORY,
} from "../transit-filter";
import { getCandidatePlaces } from "../travel-knowledge";
import { prisma } from "@/lib/db";
import { mapOsmTags } from "../../../scripts/import/india-import/osm-tag-mapping";

type Row = { name: string; category: string; placeType: string | null };

// Named like real Indian stations/stands/airports, deliberately given attraction categories
const TRANSIT_ROWS: Row[] = [
  { name: "Jaipur Junction", category: "history", placeType: null },
  { name: "Agra Cantt Jn", category: "sightseeing", placeType: null },
  { name: "Chhatrapati Shivaji Maharaj Terminus", category: "history", placeType: null },
  { name: "Howrah Railway Station", category: "history", placeType: "monument" },
  { name: "New Delhi Rly Stn", category: "sightseeing", placeType: null },
  { name: "Rajiv Chowk Metro Station", category: "sightseeing", placeType: null },
  { name: "Sindhi Camp Bus Stand", category: "local_experience", placeType: null },
  { name: "Kashmere Gate ISBT", category: "sightseeing", placeType: null },
  { name: "Majestic Bus Station", category: "culture", placeType: null },
  { name: "Indira Gandhi International Airport", category: "sightseeing", placeType: null },
  { name: "Dabolim Aerodrome", category: "sightseeing", placeType: null },
  { name: "Mandwa Ferry Terminal", category: "nature", placeType: null },
  { name: "Gateway Boat Jetty", category: "sightseeing", placeType: null },
  // Caught by placeType / category alone, whatever the name
  { name: "Shimla", category: "history", placeType: "railway_station" },
  { name: "Kalupur", category: "sightseeing", placeType: "bus_station" },
  { name: "Lokpriya Gopinath Bordoloi", category: "sightseeing", placeType: "airport" },
  { name: "Old Goa Stop", category: "transport", placeType: null },
];

// Look-alikes that ARE places to visit and must stay visible
const ATTRACTION_ROWS: Row[] = [
  { name: "Darjeeling Himalayan Railway", category: "history", placeType: "world_heritage_site" },
  { name: "Kalka–Shimla Railway", category: "history", placeType: null },
  { name: "Top Station Viewpoint", category: "nature", placeType: "viewpoint" },
  { name: "National Rail Museum", category: "culture", placeType: "museum" },
  { name: "Hawa Mahal", category: "history", placeType: "palace" },
  { name: "Dashashwamedh Ghat", category: "spiritual", placeType: null },
  { name: "Gateway of India", category: "history", placeType: "monument" },
  { name: "Junction Street Art Walk", category: "culture", placeType: null },
  { name: "Old Terminus Cafe Heritage Walk", category: "culture", placeType: null },
];

describe("isTransitPoint", () => {
  it.each(TRANSIT_ROWS.map((r) => [r.name, r]))("treats %s as transit", (_name, row) => {
    expect(isTransitPoint(row)).toBe(true);
  });

  it.each(ATTRACTION_ROWS.map((r) => [r.name, r]))("keeps %s as a place to visit", (_name, row) => {
    expect(isTransitPoint(row)).toBe(false);
  });
});

// ── The Prisma filter must exclude exactly what isTransitPoint matches ──────────────
// A small evaluator for the subset of PlaceWhereInput the filter uses. Its Postgres
// behaviour (incl. the NULL placeType case) was also checked against a live database.

function matchField(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null;
  if (typeof cond !== "object") return value === cond;
  const c = cond as Record<string, unknown>;
  const insensitive = c.mode === "insensitive";
  const str = (v: unknown) => (insensitive ? String(v).toLowerCase() : String(v));
  for (const [op, arg] of Object.entries(c)) {
    if (op === "mode") continue;
    // SQL three-valued logic: comparisons against NULL are never true
    if (value === null || value === undefined) return false;
    if (op === "not" && !(value !== arg)) return false;
    if (op === "in" && !(arg as unknown[]).includes(value)) return false;
    if (op === "notIn" && (arg as unknown[]).includes(value)) return false;
    if (op === "contains" && !str(value).includes(str(arg))) return false;
    if (op === "endsWith" && !str(value).endsWith(str(arg))) return false;
    if (!["not", "in", "notIn", "contains", "endsWith"].includes(op)) throw new Error(`unsupported op ${op}`);
  }
  return true;
}

function matchWhere(row: Record<string, unknown>, where: Prisma.PlaceWhereInput): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const list = (v: unknown) => (Array.isArray(v) ? v : [v]) as Prisma.PlaceWhereInput[];
    if (key === "AND" && !list(cond).every((w) => matchWhere(row, w))) return false;
    else if (key === "OR" && !list(cond).some((w) => matchWhere(row, w))) return false;
    else if (key === "NOT" && list(cond).some((w) => matchWhere(row, w))) return false;
    else if (!["AND", "OR", "NOT"].includes(key) && !matchField(row[key], cond)) return false;
  }
  return true;
}

describe("NOT_TRANSIT_WHERE", () => {
  it("keeps exactly the rows isTransitPoint keeps", () => {
    for (const row of [...TRANSIT_ROWS, ...ATTRACTION_ROWS]) {
      expect(matchWhere(row, NOT_TRANSIT_WHERE), row.name).toBe(!isTransitPoint(row));
    }
  });

  it("does not drop places with no placeType (SQL NOT IN on NULL)", () => {
    expect(matchWhere({ name: "Amber Fort", category: "history", placeType: null }, NOT_TRANSIT_WHERE)).toBe(true);
  });
});

// ── Itinerary candidates (feeds both V1 Gemini and V2 planners) ─────────────────

describe("getCandidatePlaces", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.travelDestination.findMany).mockResolvedValue([]);
  });

  const asPlace = (row: Row, i: number) => ({
    id: `p${i}`, slug: `p${i}`, lat: 26.9, lng: 75.8, destinationId: "jaipur", dataStatus: "seed",
    typicalCostInr: null, durationMinutes: 60, openingTime: null, closingTime: null, bestSeason: null,
    description: null, area: null, popularityScore: 50, hiddenGem: false, ...row,
  });

  it("asks the database to exclude transit points", async () => {
    vi.mocked(prisma.place.findMany).mockResolvedValue([]);
    await getCandidatePlaces({ destinationId: "jaipur", allPreferences: [] });

    const where = vi.mocked(prisma.place.findMany).mock.calls[0][0]!.where!;
    const withDest = (row: Row) => ({ ...row, destinationId: "jaipur", dataStatus: "seed" });
    for (const row of TRANSIT_ROWS) expect(matchWhere(withDest(row), where), row.name).toBe(false);
    for (const row of ATTRACTION_ROWS) expect(matchWhere(withDest(row), where), row.name).toBe(true);
  });

  it("drops a mislabelled station even if the query returns it", async () => {
    const rows = [...TRANSIT_ROWS, ...ATTRACTION_ROWS].map(asPlace);
    vi.mocked(prisma.place.findMany).mockResolvedValue(rows as never);

    const names = (await getCandidatePlaces({ destinationId: "jaipur", allPreferences: [], limit: 100 })).map((p) => p.name);

    expect(names).toEqual(expect.arrayContaining(ATTRACTION_ROWS.map((r) => r.name)));
    for (const row of TRANSIT_ROWS) expect(names).not.toContain(row.name);
  });
});

// ── Every place listing shown to travellers applies the filter ──────────────────

describe("place queries", () => {
  // Files that read places without NOT_TRANSIT_WHERE, and why that's fine
  const EXEMPT: Record<string, string> = {
    "app/admin/data/page.tsx": "admin data-quality view — must show every row, transit included",
    "lib/stay.ts": "reads category \"stay\" only (hotels for the Stay tab)",
  };
  const PLACE_QUERY = /prisma\.place\.(findMany|findFirst|count)\b|include:\s*\{\s*places:/;

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });
  }

  it("filter out transit points (or are explicitly exempt)", () => {
    const srcDir = path.resolve(__dirname, "../..");
    const offenders = sourceFiles(srcDir)
      .map((f) => path.relative(srcDir, f).split(path.sep).join("/"))
      .filter((rel) => {
        const code = fs.readFileSync(path.join(srcDir, rel), "utf-8");
        return PLACE_QUERY.test(code) && !code.includes("NOT_TRANSIT_WHERE") && !(rel in EXEMPT);
      });
    expect(offenders, "Add AND: [NOT_TRANSIT_WHERE] to these place queries (see src/lib/transit-filter.ts)").toEqual([]);
  });
});

// ── Importers ───────────────────────────────────────────────────────────────────

describe("OSM tag mapping", () => {
  it.each([
    [{ railway: "station", name: "Jaipur Junction" }, "railway_station"],
    [{ railway: "station", historic: "building", tourism: "attraction", name: "CSMT" }, "railway_station"],
    [{ railway: "halt", name: "Summer Hill" }, "railway_halt"],
    [{ public_transport: "station", train: "yes", name: "Shimla" }, "railway_station"],
    [{ station: "subway", name: "Rajiv Chowk" }, "metro_station"],
    [{ amenity: "bus_station", name: "Sindhi Camp" }, "bus_station"],
    [{ highway: "bus_stop", name: "MI Road" }, "bus_stop"],
    [{ aeroway: "aerodrome", tourism: "attraction", name: "Dabolim" }, "airport"],
    [{ amenity: "ferry_terminal", name: "Mandwa" }, "ferry_terminal"],
    [{ tourism: "attraction", name: "Old Bus Stand" }, "transit_hub"],
  ])("maps %o to transport/%s", (tags, placeType) => {
    expect(mapOsmTags(tags)).toEqual({ category: TRANSIT_CATEGORY, placeType });
  });

  it("still maps real attractions", () => {
    expect(mapOsmTags({ historic: "fort", name: "Amber Fort" })?.category).toBe("history");
    expect(mapOsmTags({ tourism: "museum", name: "National Rail Museum" })?.category).toBe("culture");
    expect(mapOsmTags({ tourism: "viewpoint", name: "Top Station Viewpoint" })?.category).toBe("sightseeing");
  });
});

describe("resolveImportedCategory (Wikidata passes)", () => {
  it("a later heritage/sightseeing pass cannot re-label a known station", () => {
    expect(resolveImportedCategory("history", TRANSIT_CATEGORY, "Howrah")).toBe(TRANSIT_CATEGORY);
    expect(resolveImportedCategory("sightseeing", "transport", "CSMT")).toBe(TRANSIT_CATEGORY);
  });

  it("recognises stations by name on first import", () => {
    expect(resolveImportedCategory("history", null, "Chhatrapati Shivaji Maharaj Terminus")).toBe(TRANSIT_CATEGORY);
  });

  it("leaves ordinary places alone", () => {
    expect(resolveImportedCategory("history", null, "Amber Fort")).toBe("history");
    expect(resolveImportedCategory("history", "sightseeing", "Darjeeling Himalayan Railway")).toBe("history");
  });
});

// ── Curated master data ─────────────────────────────────────────────────────────

describe("curated master data", () => {
  // Reviewed: CSMT is a UNESCO site but also a working terminus — hidden from attraction
  // lists by the " terminus" rule. Add a name here only after deciding that on purpose.
  const REVIEWED_TRANSIT_NAMES = ["Chhatrapati Shivaji Maharaj Terminus"];

  it("contains no transit points other than the reviewed ones", () => {
    const dir = path.resolve(__dirname, "../../../data/master/places");
    const transit = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")).places ?? []) as Row[])
      .filter((p) => isTransitPoint(p))
      .map((p) => p.name)
      .sort();
    expect(transit).toEqual(REVIEWED_TRANSIT_NAMES);
  });

  it("name rule is plain lower-casing (matches Postgres ILIKE)", () => {
    expect(isTransitName("JAIPUR JUNCTION")).toBe(true);
    expect(isTransitName("Jaipur Junction Road Fort")).toBe(false);
  });
});
