import { prisma } from "./db";
import { isHardExcluded, scorePlaceForPreferences, aggregatePreferences } from "./preference-scoring";
import { getDestinationDescendants } from "./destination-hierarchy";
import type { MemberPreference } from "./preference-scoring";

export type CandidatePlace = {
  id: string;
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
  typicalCostInr: number | null;
  durationMinutes: number | null;
  openingTime: string | null;
  closingTime: string | null;
  bestSeason: string | null;
  description: string | null;
  area: string | null;
  popularityScore: number;
  hiddenGem: boolean;
  preferenceScore: number;
};

export type CandidateQuery = {
  destinationId: string;
  allPreferences: MemberPreference[];
  budgetPerDayInr?: number;
  season?: string;
  limit?: number;
};

/**
 * Retrieve candidate places for itinerary generation.
 *
 * Pipeline:
 * 1. Expand destinationId to the full descendant hierarchy
 *    (e.g. "Goa" includes Panaji, North Goa, South Goa)
 * 2. Load all active (non-deprecated) places across the hierarchy
 * 3. Remove hard exclusions (any member said "never" for that category)
 * 4. Score remaining places by preferences
 * 5. Sort: preference score ↓, popularity ↓, hidden gems as tie-breaker
 * 6. Return top `limit` candidates
 *
 * Cross-destination contamination is prevented by design: only places
 * whose destinationId is in the resolved hierarchy subtree are included.
 */
export async function getCandidatePlaces(
  query: CandidateQuery,
): Promise<CandidatePlace[]> {
  const { destinationId, allPreferences, limit = 30 } = query;

  // Traverse parent → children hierarchy so a trip to "Goa" can include
  // places tagged to "Panaji", "North Goa", etc.
  const destinationIds = await getDestinationDescendants(destinationId);

  const rawPlaces = await prisma.place.findMany({
    where: {
      destinationId: { in: destinationIds },
      dataStatus: { not: "deprecated" },
    },
    orderBy: [{ popularityScore: "desc" }],
  });

  const aggregated = aggregatePreferences(allPreferences);

  const candidates: CandidatePlace[] = [];
  for (const place of rawPlaces) {
    if (isHardExcluded(place.category, buildHardExclusionSet(allPreferences))) {
      continue;
    }
    const preferenceScore = scorePlaceForPreferences(place.category, aggregated);
    candidates.push({
      id: place.id,
      name: place.name,
      slug: place.slug,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      typicalCostInr: place.typicalCostInr,
      durationMinutes: place.durationMinutes,
      openingTime: place.openingTime,
      closingTime: place.closingTime,
      bestSeason: place.bestSeason,
      description: place.description,
      area: place.area,
      popularityScore: place.popularityScore,
      hiddenGem: place.hiddenGem,
      preferenceScore,
    });
  }

  // Sort: preference score desc, then popularity desc, then hidden gems last (surface them only if needed)
  candidates.sort((a, b) => {
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
    return b.popularityScore - a.popularityScore;
  });

  return candidates.slice(0, limit);
}

function buildHardExclusionSet(allPreferences: MemberPreference[]): Set<string> {
  const exclusions = new Set<string>();
  for (const pref of allPreferences) {
    if (pref.priority === "never") {
      exclusions.add(pref.category);
    }
  }
  return exclusions;
}

/**
 * Look up a place by ID and verify it belongs to the expected destination hierarchy.
 * Returns null if the place doesn't exist or is not in this destination's subtree.
 */
export async function verifyPlaceOwnership(
  placeId: string,
  destinationId: string,
): Promise<{ id: string; name: string; lat: number; lng: number; category: string; typicalCostInr: number | null } | null> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, name: true, lat: true, lng: true, category: true, typicalCostInr: true, destinationId: true, dataStatus: true },
  });
  if (!place) return null;
  if (place.dataStatus === "deprecated") return null;

  const destinationIds = await getDestinationDescendants(destinationId);
  if (!destinationIds.includes(place.destinationId)) return null;

  return { id: place.id, name: place.name, lat: place.lat, lng: place.lng, category: place.category, typicalCostInr: place.typicalCostInr };
}

/**
 * Bulk verify a list of placeIds against a destination hierarchy. Returns:
 * - verified: map of placeId → place data
 * - unknown: placeIds not found or not in this destination's hierarchy
 *
 * Hierarchy-aware: a place tagged to a child destination (e.g. Panaji)
 * is considered valid when verifying against the parent (e.g. Goa).
 */
export async function bulkVerifyPlaces(
  placeIds: string[],
  destinationId: string,
): Promise<{
  verified: Map<string, { id: string; name: string; lat: number; lng: number; category: string; typicalCostInr: number | null }>;
  unknown: string[];
}> {
  if (placeIds.length === 0) {
    return { verified: new Map(), unknown: [] };
  }

  const destinationIds = await getDestinationDescendants(destinationId);

  const places = await prisma.place.findMany({
    where: {
      id: { in: placeIds },
      destinationId: { in: destinationIds },
      dataStatus: { not: "deprecated" },
    },
    select: { id: true, name: true, lat: true, lng: true, category: true, typicalCostInr: true },
  });

  const verified = new Map<string, { id: string; name: string; lat: number; lng: number; category: string; typicalCostInr: number | null }>();
  for (const p of places) {
    verified.set(p.id, p);
  }

  const unknown = placeIds.filter((id) => !verified.has(id));
  return { verified, unknown };
}
