import { prisma } from "./db";

export type MatchType = "exact" | "alias" | "fuzzy" | "unknown";

export type ResolvedDestination = {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  matchType: MatchType;
};

/**
 * Resolve a free-text destination name to a TravelDestination record.
 *
 * Resolution order:
 * 1. Exact name match (case-insensitive)
 * 2. Alias match
 * 3. Partial name match (fuzzy fallback)
 *
 * Returns null when no match is found — callers MUST NOT generate an itinerary
 * for an unresolved destination.
 */
export async function resolveDestination(
  query: string,
): Promise<ResolvedDestination | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  // Sometimes queries come in as "City, State" or "City, Country"
  // Extract just the first part for matching if it contains a comma
  const baseName = normalized.split(',')[0].trim();

  // 1. Exact match on TravelDestination.name
  let exact = await prisma.travelDestination.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
  });
  if (!exact && baseName !== normalized) {
    exact = await prisma.travelDestination.findFirst({
      where: { name: { equals: baseName, mode: "insensitive" } },
    });
  }
  if (exact) {
    return {
      id: exact.id,
      name: exact.name,
      state: exact.state,
      country: exact.country,
      lat: exact.lat,
      lng: exact.lng,
      matchType: "exact",
    };
  }

  // 2. Alias match
  let aliasRecord = await prisma.destinationAlias.findFirst({
    where: { alias: { equals: normalized, mode: "insensitive" } },
    include: { destination: true },
  });
  if (!aliasRecord && baseName !== normalized) {
    aliasRecord = await prisma.destinationAlias.findFirst({
      where: { alias: { equals: baseName, mode: "insensitive" } },
      include: { destination: true },
    });
  }
  if (aliasRecord) {
    const d = aliasRecord.destination;
    return {
      id: d.id,
      name: d.name,
      state: d.state,
      country: d.country,
      lat: d.lat,
      lng: d.lng,
      matchType: "alias",
    };
  }

  // 3. Partial/fuzzy name match (contains query, case-insensitive)
  // Only used as a last resort — confidence is lower.
  let partial = await prisma.travelDestination.findFirst({
    where: { name: { contains: normalized, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  if (!partial && baseName !== normalized) {
    partial = await prisma.travelDestination.findFirst({
      where: { name: { contains: baseName, mode: "insensitive" } },
      orderBy: { name: "asc" },
    });
  }
  if (partial) {
    return {
      id: partial.id,
      name: partial.name,
      state: partial.state,
      country: partial.country,
      lat: partial.lat,
      lng: partial.lng,
      matchType: "fuzzy",
    };
  }

  return null;
}

/**
 * Search travel destinations for autocomplete / trip creation UI.
 */
export async function searchTravelDestinations(query: string, limit = 10) {
  if (!query.trim()) return [];
  return prisma.travelDestination.findMany({
    where: { name: { contains: query.trim(), mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: limit,
  });
}
