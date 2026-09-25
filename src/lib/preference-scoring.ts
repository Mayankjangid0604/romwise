import { PLACE_TO_PREFERENCE_CATEGORY, type PlaceCategory } from "./categories";
import type { Priority } from "./preferences";

export type MemberPreference = {
  category: string;
  priority: Priority;
};

export type ScoredPreference = {
  category: string;
  score: number;
  isHardExclusion: boolean;
};

// Numeric score assigned to each priority level
const PRIORITY_SCORES: Record<Priority, number> = {
  "must-have": 40,
  "very-important": 20,
  "preferred": 10,
  "nice-to-have": 5,
  "avoid": -20,
  "never": -999, // treated as hard exclusion
};

export const NEVER_SCORE = PRIORITY_SCORES["never"];
export const HARD_EXCLUSION_THRESHOLD = -100;

/**
 * Given all preferences from all group members, compute aggregate scores per
 * preference category.
 *
 * Conflict example:
 *   A: nightlife must-have (+40)
 *   B: nightlife never    (-999)
 *   → aggregate = -959, isHardExclusion = true
 *
 * The `never` constraint from any single member creates a hard exclusion.
 * `must-have` does NOT override another member's `never`.
 */
export function aggregatePreferences(
  allPreferences: MemberPreference[],
): Map<string, ScoredPreference> {
  const categoryMap = new Map<string, { total: number; hasNever: boolean }>();

  for (const pref of allPreferences) {
    const score = PRIORITY_SCORES[pref.priority as Priority] ?? 0;
    const entry = categoryMap.get(pref.category) ?? { total: 0, hasNever: false };
    entry.total += score;
    if (pref.priority === "never") {
      entry.hasNever = true;
    }
    categoryMap.set(pref.category, entry);
  }

  const result = new Map<string, ScoredPreference>();
  for (const [category, { total, hasNever }] of categoryMap) {
    result.set(category, {
      category,
      score: total,
      isHardExclusion: hasNever,
    });
  }
  return result;
}

/**
 * Returns the set of categories that are hard exclusions (any member said "never").
 */
export function getHardExclusions(
  allPreferences: MemberPreference[],
): Set<string> {
  const exclusions = new Set<string>();
  for (const pref of allPreferences) {
    if (pref.priority === "never") {
      exclusions.add(pref.category);
    }
  }
  return exclusions;
}

/**
 * Score a place against aggregated preferences.
 * Uses PLACE_TO_PREFERENCE_CATEGORY to map place category → preference category.
 */
export function scorePlaceForPreferences(
  place: { category: string; placeType?: string | null },
  aggregated: Map<string, ScoredPreference>,
): number {
  let score = 0;
  
  if (place.category === "spiritual") {
    // If user prefers fewer spiritual sites, penalize them
    const fewerSpiritual = aggregated.get("fewer_spiritual")?.score ?? 0;
    if (fewerSpiritual > 0) {
      score -= fewerSpiritual; // penalty if "fewer_spiritual" is preferred/must-have
    }
    
    // Evaluate specific spiritual preferences
    const specificPrefCategory = getSpiritualPreferenceCategory(place.placeType);
    const specificScore = aggregated.get(specificPrefCategory)?.score ?? 0;
    
    // Evaluate general spiritual preferences if no specific one is found
    const generalScore = aggregated.get("spiritual_general")?.score ?? 0;
    
    score += Math.max(specificScore, generalScore);
  }

  const prefCategory = PLACE_TO_PREFERENCE_CATEGORY[place.category as PlaceCategory];
  if (prefCategory) {
    score += aggregated.get(prefCategory)?.score ?? 0;
  }
  
  return score;
}

/**
 * Returns true if this place category is excluded by any member's "never" preference.
 * This is a HARD server-side constraint that must be enforced regardless of Gemini output.
 */
export function isHardExcluded(
  place: { category: string; placeType?: string | null },
  hardExclusions: Set<string>,
): boolean {
  if (place.category === "spiritual") {
    if (hardExclusions.has("fewer_spiritual") || hardExclusions.has("spiritual_general")) {
      return true; // Exclude if they hard-avoid all spiritual sites
    }
    const specificPrefCategory = getSpiritualPreferenceCategory(place.placeType);
    if (hardExclusions.has(specificPrefCategory)) {
      return true;
    }
  }

  const prefCategory = PLACE_TO_PREFERENCE_CATEGORY[place.category as PlaceCategory];
  if (!prefCategory) return false;
  return hardExclusions.has(prefCategory);
}

function getSpiritualPreferenceCategory(placeType?: string | null): string {
  if (!placeType) return "spiritual_general";
  const type = placeType.toLowerCase();
  if (type.includes("temple")) {
    if (type.includes("jain")) return "jain_heritage";
    return "hindu_heritage";
  }
  if (type.includes("mosque") || type.includes("dargah")) return "islamic_heritage";
  if (type.includes("gurdwara")) return "sikh_heritage";
  if (type.includes("church")) return "christian_heritage";
  if (type.includes("monastery") || type.includes("stupa") || type.includes("buddhist")) return "buddhist_heritage";
  
  return "other_sacred_heritage";
}

/**
 * Detect and describe conflicts between member preferences.
 */
export type PreferenceConflict = {
  category: string;
  neverMembers: number;
  mustHaveMembers: number;
  resolution: string;
};

export function detectPreferenceConflicts(
  allPreferences: MemberPreference[],
): PreferenceConflict[] {
  const byCategory = new Map<string, { never: number; mustHave: number }>();

  for (const pref of allPreferences) {
    const entry = byCategory.get(pref.category) ?? { never: 0, mustHave: 0 };
    if (pref.priority === "never") entry.never++;
    if (pref.priority === "must-have") entry.mustHave++;
    byCategory.set(pref.category, entry);
  }

  const conflicts: PreferenceConflict[] = [];
  for (const [category, counts] of byCategory) {
    if (counts.never > 0 && counts.mustHave > 0) {
      conflicts.push({
        category,
        neverMembers: counts.never,
        mustHaveMembers: counts.mustHave,
        resolution: `"never" takes precedence — ${category} excluded from itinerary`,
      });
    }
  }
  return conflicts;
}
