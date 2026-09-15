// Single canonical source for all activity/place categories used across Trip Brain,
// preference system, budget engine, and place data.

export const PLACE_CATEGORIES = [
  "sightseeing",
  "culture",
  "history",
  "nature",
  "adventure",
  "dining",
  "nightlife",
  "shopping",
  "relaxation",
  "photography",
  "spiritual",
  "family",
  "local_experience",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export function isValidPlaceCategory(value: string): value is PlaceCategory {
  return PLACE_CATEGORIES.includes(value as PlaceCategory);
}

// Subset used by the traveler preference system (must stay in sync with existing
// TravelerPreference records — do not remove values that may be stored in the DB).
export const PREFERENCE_CATEGORIES = [
  "dining",
  "sightseeing",
  "adventure",
  "culture",
  "shopping",
  "relaxation",
  "nightlife",
  "nature",
] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];

export function isValidPreferenceCategory(value: string): value is PreferenceCategory {
  return PREFERENCE_CATEGORIES.includes(value as PreferenceCategory);
}

// Maps broad place categories to the preference categories used for scoring.
// Place categories not listed here contribute to the "neutral" scoring bucket.
export const PLACE_TO_PREFERENCE_CATEGORY: Partial<Record<PlaceCategory, PreferenceCategory>> = {
  sightseeing: "sightseeing",
  culture: "culture",
  history: "culture",
  nature: "nature",
  adventure: "adventure",
  dining: "dining",
  nightlife: "nightlife",
  shopping: "shopping",
  relaxation: "relaxation",
  photography: "sightseeing",
  spiritual: "culture",
  family: "sightseeing",
  local_experience: "culture",
};

// Categories that are valid in Gemini Trip Brain output (superset of preference categories).
// These are what the LLM is allowed to use in generated itinerary items.
export const TRIP_BRAIN_CATEGORIES: readonly string[] = PLACE_CATEGORIES;
