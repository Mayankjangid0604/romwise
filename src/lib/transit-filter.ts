/**
 * Transit infrastructure — railway/metro stations, bus stands, airports, ferry terminals —
 * is a way to get somewhere, not somewhere to visit. It must never be offered as an
 * attraction/activity (itinerary candidates, "add a place", the Places browser,
 * destination highlights, copilot additions).
 *
 * One rule, two forms built from the same lists so they can't drift apart:
 *  - `isTransitPoint(place)`      — in-memory check (AI output, lists already loaded)
 *  - `NOT_TRANSIT_WHERE`          — Prisma filter for paginated/DB-side queries
 *
 * Why name patterns as well as category: imported data (OSM/Wikidata) has labelled
 * stations as "history"/"sightseeing" (e.g. a station that is also a heritage building),
 * so category alone isn't enough. Patterns are deliberately specific: heritage *railway
 * rides* ("Darjeeling Himalayan Railway"), "Top Station Viewpoint" or a "Rail Museum"
 * are not matched.
 */
import type { Prisma } from "@prisma/client";

export const TRANSIT_CATEGORY = "transport";

export const TRANSIT_PLACE_TYPES = [
  "railway_station", "train_station", "railway_halt", "metro_station", "subway_station", "monorail_station",
  "bus_station", "bus_stand", "bus_stop", "bus_terminal",
  "airport", "aerodrome", "airport_terminal", "helipad",
  "ferry_terminal", "jetty",
  "taxi_stand", "transit_hub",
] as const;

/** Lower-case substrings that mark a transit facility wherever they appear in the name. */
export const TRANSIT_NAME_SUBSTRINGS = [
  "railway station", "railway stn", "rly station", "rly stn", "train station",
  "metro station", "subway station", "monorail station", "mrts station",
  "railway junction", "railway terminus",
  "bus station", "bus stand", "bus stop", "bus depot", "bus terminal", "bus terminus", "bus adda",
  "isbt", "inter state bus terminal", "interstate bus terminal",
  "airport", "aerodrome",
  "ferry terminal", "ferry wharf", "boat jetty",
] as const;

/** Lower-case suffixes: station names such as "Jaipur Junction", "Agra Cantt Jn", "… Terminus". */
export const TRANSIT_NAME_SUFFIXES = [" junction", " jn", " jn.", " terminus"] as const;

export type PlaceLike = { name: string; category?: string | null; placeType?: string | null };

export function isTransitName(name: string): boolean {
  // Plain lower-casing only, so this matches exactly what the SQL form (ILIKE) matches
  const n = name.toLowerCase();
  return (
    TRANSIT_NAME_SUBSTRINGS.some((s) => n.includes(s)) ||
    TRANSIT_NAME_SUFFIXES.some((s) => n.endsWith(s))
  );
}

export function isTransitPoint(place: PlaceLike): boolean {
  if (place.category === TRANSIT_CATEGORY) return true;
  if (place.placeType && (TRANSIT_PLACE_TYPES as readonly string[]).includes(place.placeType)) return true;
  return isTransitName(place.name);
}

/**
 * Prisma `where` fragment excluding everything `isTransitPoint` matches. Combine with
 * other conditions via `AND: [NOT_TRANSIT_WHERE, …]` (or spread into a `where` that has
 * no other `NOT`/`OR`).
 *
 * Note the explicit null handling: in SQL `placeType NOT IN (…)` is NULL (→ row dropped)
 * when placeType is NULL, which would hide most places.
 */
export const NOT_TRANSIT_WHERE: Prisma.PlaceWhereInput = {
  category: { not: TRANSIT_CATEGORY },
  OR: [{ placeType: null }, { placeType: { notIn: [...TRANSIT_PLACE_TYPES] } }],
  NOT: [
    ...TRANSIT_NAME_SUBSTRINGS.map((s) => ({ name: { contains: s, mode: "insensitive" as const } })),
    ...TRANSIT_NAME_SUFFIXES.map((s) => ({ name: { endsWith: s, mode: "insensitive" as const } })),
  ],
};

/**
 * Category to store when an importer (re)classifies a place. Once a place is known to be
 * transit it stays transit: the Wikidata importer runs one query per category and each
 * pass overwrote the previous one, so a station that is also a "heritage building" or
 * "World Heritage Site" ended up as history/sightseeing — i.e. offered as an attraction.
 */
export function resolveImportedCategory(
  incoming: string,
  existing: string | null | undefined,
  name: string,
): string {
  if (incoming === TRANSIT_CATEGORY || existing === TRANSIT_CATEGORY || isTransitName(name)) {
    return TRANSIT_CATEGORY;
  }
  return incoming;
}
