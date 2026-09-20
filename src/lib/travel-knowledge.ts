import { prisma } from "./db";
import { isHardExcluded, scorePlaceForPreferences, aggregatePreferences } from "./preference-scoring";
import { getDestinationDescendants } from "./destination-hierarchy";
import type { MemberPreference } from "./preference-scoring";
import type { AccessibilityRequirement } from "./trip-brain";

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
  // Accessibility fields from DB
  accessibilityScore: number | null;
  fatigueCost: number | null;
};

export type CandidateQuery = {
  destinationId: string;
  allPreferences: MemberPreference[];
  budgetPerDayInr?: number;
  season?: "winter" | "summer" | "monsoon" | "post_monsoon";
  limit?: number;
  accessibilityRequirement?: AccessibilityRequirement;
};

/**
 * Retrieve candidate places for itinerary generation.
 *
 * Pipeline:
 * 1. Expand destinationId to the full descendant hierarchy
 *    (e.g. "Goa" includes Panaji, North Goa, South Goa)
 * 2. Load all active (non-deprecated) places across the hierarchy
 * 3. Remove hard exclusions (any member said "never" for that category)
 * 4. Apply accessibility filtering (B-003):
 *    - low_walking: exclude fatigueCost >= 4
 *    - wheelchair: exclude accessibilityScore null or <= 2
 *    - senior: exclude fatigueCost >= 4
 *    - child: exclude fatigueCost >= 5
 * 5. Score remaining places by preferences + season
 * 6. Apply accessibility boosting to high-accessibility places
 * 7. Sort: combined score desc, then popularity desc
 * 8. Return top `limit` candidates
 */
export async function getCandidatePlaces(
  query: CandidateQuery,
): Promise<CandidatePlace[]> {
  const { destinationId, allPreferences, limit = 30, accessibilityRequirement } = query;

  // Traverse parent → children hierarchy so a trip to "Goa" can include
  // places tagged to "Panaji", "North Goa", etc.
  const destinationIds = await getDestinationDescendants(destinationId);

  const rawPlaces = await prisma.place.findMany({
    where: {
      destinationId: { in: destinationIds },
      dataStatus: { notIn: ["deprecated", "REJECTED"] },
    },
    orderBy: [{ popularityScore: "desc" }],
  });

  const aggregated = aggregatePreferences(allPreferences);

  const candidates: CandidatePlace[] = [];
  for (const place of rawPlaces) {
    if (isHardExcluded(place.category, buildHardExclusionSet(allPreferences))) {
      continue;
    }

    // B-003: Accessibility hard filtering based on DB fields
    if (accessibilityRequirement && accessibilityRequirement !== "none") {
      const fatigue = place.fatigueCost;
      const accessibility = place.accessibilityScore;

      if (accessibilityRequirement === "wheelchair") {
        // Wheelchair: must have known, good accessibility score
        if (accessibility === null || accessibility <= 2) continue;
      } else if (accessibilityRequirement === "low_walking") {
        // Low walking: exclude high-fatigue places
        if (fatigue !== null && fatigue >= 4) continue;
      } else if (accessibilityRequirement === "senior") {
        // Senior: exclude high-fatigue places
        if (fatigue !== null && fatigue >= 4) continue;
      } else if (accessibilityRequirement === "child") {
        // Child: exclude very demanding places only
        if (fatigue !== null && fatigue >= 5) continue;
      }
    }

    const preferenceScore = scorePlaceForPreferences(place.category, aggregated);
    const seasonScore = scoreForSeason(place.bestSeason, query.season);

    // B-003: Accessibility score boost for high-accessibility places
    let accessibilityBoost = 0;
    if (accessibilityRequirement && accessibilityRequirement !== "none") {
      const accessibility = place.accessibilityScore;
      if (accessibilityRequirement === "wheelchair" && accessibility !== null && accessibility >= 4) {
        accessibilityBoost = 20;
      } else if ((accessibilityRequirement === "low_walking" || accessibilityRequirement === "senior") &&
                 accessibility !== null && accessibility >= 3) {
        accessibilityBoost = 15;
      } else if (accessibilityRequirement === "child" && place.category === "family") {
        accessibilityBoost = 15;
      }
    }

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
      preferenceScore: preferenceScore + seasonScore + accessibilityBoost,
      accessibilityScore: place.accessibilityScore,
      fatigueCost: place.fatigueCost,
    });
  }

  // Sort: combined preference+season score desc, then popularity desc
  candidates.sort((a, b) => {
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
    return b.popularityScore - a.popularityScore;
  });

  return candidates.slice(0, limit);
}

/**
 * Score a place for the current travel season.
 * Returns: +10 (in-season), 0 (unknown/year-round), -15 (out of season).
 * Out-of-season places are de-prioritised but not excluded.
 */
export function scoreForSeason(
  bestSeason: string | null,
  season: "winter" | "summer" | "monsoon" | "post_monsoon" | undefined,
): number {
  if (!bestSeason || !season || bestSeason === "year-round") return 0;

  const seasonKeywords: Record<string, string[]> = {
    winter: ["oct", "nov", "dec", "jan", "feb", "mar", "winter", "oct–mar", "nov–feb", "oct–apr"],
    summer: ["apr", "may", "jun", "summer", "mar–jun", "apr–jun"],
    monsoon: ["jul", "aug", "sep", "monsoon", "jun–sep", "jul–sep"],
    post_monsoon: ["oct", "sep", "oct–nov", "post_monsoon"],
  };

  const lower = bestSeason.toLowerCase();
  const keywords = seasonKeywords[season] ?? [];
  if (keywords.some((kw) => lower.includes(kw))) return 10;

  // Negative keyword check — clearly wrong season
  const oppositeMap: Record<string, string[]> = {
    winter: ["jun", "jul", "aug", "sep", "monsoon"],
    summer: ["dec", "jan", "feb", "winter"],
    monsoon: ["oct", "nov", "dec", "jan", "feb", "winter"],
    post_monsoon: ["jan", "feb", "jun", "jul", "aug"],
  };
  const opposite = oppositeMap[season] ?? [];
  if (opposite.some((kw) => lower.includes(kw) && !keywords.some((gk) => lower.includes(gk)))) {
    return -15;
  }

  return 0; // Ambiguous — no penalty
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
  if (place.dataStatus === "deprecated" || place.dataStatus === "REJECTED") return null;

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
      dataStatus: { notIn: ["deprecated", "REJECTED"] },
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
