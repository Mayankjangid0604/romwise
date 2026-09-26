/**
 * Trip Brain — grounded itinerary generation pipeline.
 *
 * Pipeline:
 * 1. Resolve destination → TravelDestination (error if unknown)
 * 2. Derive travel season from startDate
 * 3. Retrieve candidate places (preference-scored, season-aware, hard exclusions applied)
 * 4. If no candidates → DestinationDataError (no Gemini call)
 * 5. If Gemini available → send candidates to Gemini for synthesis
 * 6. Validate Gemini response → all placeIds must exist in candidate set
 * 7. Override estimated costs with authoritative DB costs (B-001)
 * 8. Assign variable time slots based on durationMinutes (B-002/C-001)
 * 9. If Gemini unavailable OR fails → deterministic fallback from candidates
 * 10. Return grounded GeneratedDay[]
 *
 * Architecture principle:
 *   DATABASE = FACTS (costs, coordinates, hours, durations)
 *   TRIP BRAIN = REASONING (which places, which order)
 *   GEMINI = SYNTHESIS (narrative, scheduling rationale)
 *
 * Gemini is NOT allowed to invent prices, coordinates, or place names.
 */

import { z } from "zod";
import { AIGateway } from "./ai/gateway";
import { AIGatewayError } from "./ai/types";
import { haversineKm, estimateTravelMinutes } from "./route-optimizer";
import { resolveDestination } from "./destination-resolver";
import { getTripDuration, isFlexibleTripDates, TripType, getTripStartEndDateTimes } from "./date-utils";
import { getCandidatePlaces, bulkVerifyPlaces } from "./travel-knowledge";
import {
  aggregatePreferences,
  detectPreferenceConflicts,
  getHardExclusions,
} from "./preference-scoring";
import type { CandidatePlace } from "./travel-knowledge";
import type { MemberPreference } from "./preference-scoring";
import type { ResolvedDestination } from "./destination-resolver";

// ── Error types ────────────────────────────────────────────────────────────────

export class DestinationNotFoundError extends Error {
  constructor(destination: string) {
    super(`Destination "${destination}" is not in the travel knowledge database. No itinerary can be generated.`);
    this.name = "DestinationNotFoundError";
  }
}

export class DestinationDataError extends Error {
  constructor(destination: string) {
    super(`No place data available for "${destination}" yet. Itinerary generation requires at least one known place.`);
    this.name = "DestinationDataError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type PaceLevel = "easy" | "balanced" | "full";

export type TripBrainInput = {
  destination: string;
  waypoints?: string[];      // additional stops for multi-destination trips
  startDate: Date | null;
  endDate: Date | null;
  dateStatus?: string | null;
  tripType: string;
  timeStatus: string;
  startTime: string | null;
  endTime: string | null;
  budgetInr: number;
  maxTravelers: number;
  paceLevel: PaceLevel;
  allPreferences: MemberPreference[];
  accessibilityNotes?: string;
  travelSegments?: Record<string, string>[];
  accommodations?: Record<string, string>[];
  placeSelections?: { placeId: string; status: string }[];
};

export type GeneratedActivity = {
  placeId: string;
  title: string;
  description: string;
  category: string;
  estimatedCostInr: number;
  /** costSource distinguishes authoritative DB data from AI estimates */
  costSource: "db" | "ai_estimated" | "free" | "unknown";
  lat: number;
  lng: number;
  reasoning: string;
};

export type GeneratedDay = {
  dayNumber: number;
  date: Date;
  items: {
    placeId: string | null;
    title: string;
    description: string;
    category: string;
    startTime: string;
    endTime: string;
    estimatedCostInr: number | null;
    /** costSource distinguishes authoritative DB data from AI estimates */
    costSource: "db" | "ai_estimated" | "free" | "unknown";
    lat: number | null;
    lng: number | null;
    reasoning: string;
    order: number;
  }[];
};

// ── Season derivation (F-003) ──────────────────────────────────────────────────

/**
 * Derive the travel season from the trip start date.
 * Uses Indian seasonal calendar as the reference.
 */
export function deriveSeason(date: Date | null): "winter" | "summer" | "monsoon" | "post_monsoon" | "unknown" {
  if (!date) return "unknown";
  const month = date.getMonth() + 1; // 1-indexed
  if (month >= 11 || month <= 2) return "winter";    // Nov–Feb
  if (month >= 3 && month <= 5) return "summer";      // Mar–May
  if (month >= 6 && month <= 9) return "monsoon";     // Jun–Sep
  return "post_monsoon";                               // Oct
}

/**
 * Map season to a human-readable label for prompts and UI.
 */
export function seasonLabel(season: ReturnType<typeof deriveSeason>): string {
  if (season === "unknown") return "Unknown Season (flexible dates)";
  return {
    winter: "Winter (Nov–Feb) — peak travel season in most of India",
    summer: "Summer (Mar–May) — hot in plains, pleasant in hill stations",
    monsoon: "Monsoon (Jun–Sep) — lush landscapes, some closures, reduced travel",
    post_monsoon: "Post-monsoon / Autumn (Oct) — excellent in most regions",
  }[season];
}

// ── Dynamic time slot builder (B-002 + C-001) ─────────────────────────────────

/**
 * Default activity durations by category (minutes).
 * Used as fallback when a place has no durationMinutes.
 */
const DEFAULT_DURATION_BY_CATEGORY: Record<string, number> = {
  history: 90,
  culture: 60,
  spiritual: 45,
  nature: 120,
  adventure: 180,
  sightseeing: 60,
  relaxation: 90,
  photography: 60,
  local_experience: 75,
  dining: 60,
  shopping: 60,
  nightlife: 120,
  family: 90,
};

const TRAVEL_BUFFER_MINUTES = 30; // assumed inter-activity travel

/** Returns the effective visit duration for a place in minutes. */
function effectiveDuration(place: CandidatePlace): number {
  if (place.durationMinutes && place.durationMinutes > 0) {
    return place.durationMinutes;
  }
  return DEFAULT_DURATION_BY_CATEGORY[place.category] ?? 90;
}

/** Format minutes-from-midnight as "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "HH:MM" to minutes-from-midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Start times by pace level (minutes from midnight) */
const DAY_START_BY_PACE: Record<PaceLevel, number> = {
  easy: 9 * 60,      // 09:00
  balanced: 8 * 60,  // 08:00
  full: 7 * 60,      // 07:00
};

/** Slots per day by pace */
const SLOTS_PER_DAY: Record<PaceLevel, number> = {
  easy: 4,
  balanced: 5,
  full: 7,
};

/**
 * Build variable time slots for a list of places in a day.
 * Each slot duration = place.durationMinutes (or category default).
 * Gap between slots = TRAVEL_BUFFER_MINUTES.
 *
 * B-002 + C-001: This replaces the hardcoded 90-minute slots.
 * Returns null for any place whose time window would exceed its closingTime.
 */
function buildTimeSlotsForPlaces(
  places: CandidatePlace[],
  paceLevel: PaceLevel,
  dayStartMins: number,
  dayEndMins: number,
): ({ start: string; end: string } | null)[] {
  let cursor = dayStartMins;
  return places.map((place, index) => {
    let travelMins = TRAVEL_BUFFER_MINUTES;
    if (index > 0) {
      const prev = places[index - 1];
      const dist = haversineKm(prev.lat, prev.lng, place.lat, place.lng);
      travelMins = estimateTravelMinutes(dist);
      travelMins = Math.max(10, Math.min(120, travelMins));
    } else {
      travelMins = 0;
    }

    cursor += travelMins;

    // Advance cursor to opening time if we arrive early
    if (place.openingTime) {
      const openMins = timeToMinutes(place.openingTime);
      if (cursor < openMins) {
        cursor = openMins;
      }
    }

    const duration = effectiveDuration(place);
    const start = cursor;
    const end = cursor + duration;

    // B-002 HARD ENFORCEMENT: Drop items that end after closing time.
    // A place with unknown hours (openingHoursStatus = "unknown" or null closingTime)
    // is allowed but not confirmed. A place with a known closingTime that is exceeded
    // must be removed — it cannot be silently over-scheduled.
    if (place.closingTime) {
      const closingMins = timeToMinutes(place.closingTime);
      if (end > closingMins || end > dayEndMins) {
        // Item cannot fit before closing — mark as invalid (null)
        // Cursor stays at start (before this place's travel buffer was added)
        cursor = start - travelMins; // rewind
        return null;
      }
    }
    
    // Also respect user time window
    if (end > dayEndMins) {
      cursor = start - travelMins; // rewind
      return null;
    }

    cursor = end;
    return { start: minutesToTime(start), end: minutesToTime(end) };
  });
}

/**
 * Build a fixed-slot schedule (for prompt construction, where we don't know
 * which places will be selected yet). Uses the category-default durations
 * for a "typical" slot sequence.
 */
function buildDefaultSlotsForCount(
  slotCount: number,
  paceLevel: PaceLevel,
): { start: string; end: string }[] {
  let cursor = DAY_START_BY_PACE[paceLevel];
  const slots: { start: string; end: string }[] = [];
  for (let i = 0; i < slotCount; i++) {
    const duration = 90; // prompt hint only — actual overridden post-selection
    slots.push({ start: minutesToTime(cursor), end: minutesToTime(cursor + duration) });
    cursor += duration + TRAVEL_BUFFER_MINUTES;
  }
  return slots;
}

// ── Cost assignment (B-001) ────────────────────────────────────────────────────

/**
 * Determine the authoritative cost for an itinerary item.
 *
 * Priority:
 *  1. DB typicalCostInr (costStatus = "free" | "known") — highest authority
 *  2. DB typicalCostInr (costStatus = "estimated") — use but mark as estimated
 *  3. AI-returned estimatedCostInr — use only as last resort, mark clearly
 *  4. null — unknown; do not show as a fact
 *
 * This ensures Gemini cannot become the source of truth for prices.
 */
function resolveItemCost(
  candidate: CandidatePlace,
): { cost: number | null; source: "db" | "free" | "unknown" } {
  // Free places
  if (candidate.typicalCostInr === 0) {
    return { cost: 0, source: "free" };
  }

  // DB has an authoritative or estimated cost
  if (candidate.typicalCostInr != null && candidate.typicalCostInr > 0) {
    return { cost: candidate.typicalCostInr, source: "db" };
  }

  return { cost: null, source: "unknown" };
}

// ── Gemini prompt + response types ────────────────────────────────────────────

function buildGroundedPrompt(
  destination: ResolvedDestination,
  dayCount: number,
  slotsPerDay: number,
  budgetInr: number,
  paceLevel: PaceLevel,
  season: ReturnType<typeof deriveSeason>,
  candidates: CandidatePlace[],
  allPreferences: MemberPreference[],
  accessibilityNotes?: string,
  timeStatus?: string,
  travelSegments?: Record<string, string>[],
  accommodations?: Record<string, string>[],
): string {
  const dailyBudget = Math.floor(budgetInr / dayCount);

  const aggregated = aggregatePreferences(allPreferences);
  const conflicts = detectPreferenceConflicts(allPreferences);

  const prefLines: string[] = [];
  for (const [category, sp] of aggregated) {
    if (sp.isHardExclusion) {
      prefLines.push(`  ${category}: HARD EXCLUSION (never) — do not include`);
    } else if (sp.score > 0) {
      prefLines.push(`  ${category}: preferred (score ${sp.score})`);
    } else if (sp.score < 0) {
      prefLines.push(`  ${category}: avoid`);
    }
  }

  const candidateJson = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    area: c.area ?? undefined,
    // Send authoritative cost as the ground truth. Gemini must not invent prices.
    typicalCostInr: c.typicalCostInr !== null ? c.typicalCostInr : "unknown",
    durationMinutes: c.durationMinutes ?? undefined,
    openingTime: c.openingTime ?? undefined,
    closingTime: c.closingTime ?? undefined,
    description: c.description ?? undefined,
    preferenceScore: c.preferenceScore,
    bestSeason: c.bestSeason ?? undefined,
  }));

  const diningCandidates = candidates.filter((c) => c.category === "dining");
  
  const logisticsLines: string[] = [];
  if (timeStatus === "exact") logisticsLines.push(`- MUST align with strict time windows.`);
  if (travelSegments && travelSegments.length > 0) {
    logisticsLines.push(`- TRAVEL LOGISTICS: ${travelSegments.length} travel segments provided. Adjust daily start/end times so they do not conflict with arrival and departure.`);
    logisticsLines.push(`- MUST preserve enough time to reach departure locations (DO NOT use an arbitrary fixed 60-minute buffer, use actual intelligent travel time reasoning).`);
  }
  if (accommodations && accommodations.length > 0) {
    logisticsLines.push(`- ACCOMMODATIONS: ${accommodations.length} stays booked. Account for check-in/check-out dates in your reasoning.`);
    logisticsLines.push(`- DO NOT schedule hotel-room-dependent activity before 14:00 on check-in day unless explicitly marked otherwise.`);
  }

  return `You are a travel itinerary planner. Arrange the provided candidate places into a ${dayCount}-day itinerary for ${destination.name}, ${destination.state}.

TRIP CONTEXT:
- Days: ${dayCount}
- Activities per day: ${slotsPerDay} (${paceLevel} pace)
- Total budget: ₹${budgetInr} (~₹${dailyBudget}/day for activities)
- Travel season: ${seasonLabel(season)}
${accessibilityNotes ? `- Accessibility needs: ${accessibilityNotes}` : ""}

LOGISTICS & CONSTRAINTS:
${logisticsLines.length > 0 ? logisticsLines.join("\n") : "  Standard scheduling"}

TRAVELER PREFERENCES:
${prefLines.length > 0 ? prefLines.join("\n") : "  No specific preferences"}
${conflicts.length > 0 ? `\nPREFERENCE CONFLICTS RESOLVED:\n${conflicts.map((c) => `  ${c.resolution}`).join("\n")}` : ""}

CANDIDATE PLACES (select ONLY from this list — do NOT invent new places):
${JSON.stringify(candidateJson, null, 2)}

SELECTION RULES:
- Select ONLY places from the candidate list above using their exact "id" values
- Do NOT invent new places, restaurants, or locations not in this list
- NEVER schedule transit infrastructure (railway/metro stations, bus stands, airports, ferry terminals) or hotels as activities — they are not places to visit
- Aim for category variety across days — avoid repeating the same category consecutively
${diningCandidates.length > 0 ? `- Include at least one dining activity per day if possible (${diningCandidates.length} dining options available)` : "- No dining candidates available — skip dining activities"}
- Hard exclusions must not appear (marked above)
- Keep each day's total estimated cost under ₹${dailyBudget}
- For scheduling: consider place openingTime/closingTime — do not schedule closed places
- DO NOT schedule activities during travel arrival or departure times
- Group activities by area within a day to minimise travel
- Prefer in-season or year-round places over out-of-season ones
- A place MAY appear more than once across different days only if the candidate list is very small

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "days": [
    {
      "dayNumber": 1,
      "items": [
        {
          "placeId": "<exact id from candidate list>",
          "reasoning": "Brief: why this place in this position"
        }
      ]
    }
  ]
}

Generate exactly ${slotsPerDay} items per day, ${dayCount} days total.`;
}

// ── Gemini response validation ─────────────────────────────────────────────────

const geminiRawItemSchema = z.object({
  placeId: z.string().min(1),
  reasoning: z.string().default("")
});

const geminiRawDaySchema = z.object({
  dayNumber: z.number(),
  items: z.array(geminiRawItemSchema)
});

const geminiResponseSchema = z.object({
  days: z.array(geminiRawDaySchema)
});

type GeminiRawItem = z.infer<typeof geminiRawItemSchema>;
type GeminiRawDay = z.infer<typeof geminiRawDaySchema>;

function parseGeminiResponse(
  raw: string,
  expectedDays: number,
  expectedItemsPerDay: number,
): GeminiRawDay[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIGatewayError("Trip Brain response is not valid JSON", "AI_INVALID_OUTPUT");
  }

  const validation = geminiResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new AIGatewayError("Trip Brain response does not match expected schema", "AI_INVALID_OUTPUT");
  }

  const days = validation.data.days;

  if (days.length !== expectedDays) {
    throw new AIGatewayError(`Expected ${expectedDays} days, got ${days.length}`, "AI_INVALID_OUTPUT");
  }

  for (let i = 0; i < days.length; i++) {
    if (days[i].items.length !== expectedItemsPerDay) {
      throw new AIGatewayError(
        `Day ${i + 1}: expected ${expectedItemsPerDay} items, got ${days[i].items.length}`,
        "AI_INVALID_OUTPUT",
      );
    }
  }

  return days;
}

/**
 * Validate Gemini output against the candidate set.
 * All placeIds must exist in candidateMap. Unknown IDs are rejected.
 * Hard exclusion categories must not appear.
 */
function validateGroundedResponse(
  days: GeminiRawDay[],
  candidateMap: Map<string, CandidatePlace>,
  hardExclusions: Set<string>,
): void {
  for (const day of days) {
    for (const item of day.items) {
      const candidate = candidateMap.get(item.placeId);
      if (!candidate) {
        throw new AIGatewayError(
          `Day ${day.dayNumber}: placeId "${item.placeId}" is not in the candidate list. Rejecting response.`,
          "AI_INVALID_OUTPUT"
        );
      }
      if (hardExclusions.has(candidate.category)) {
        throw new ValidationError(
          `Day ${day.dayNumber}: place "${candidate.name}" (category: ${candidate.category}) is hard-excluded by a "never" preference.`,
        );
      }
    }
  }
}


export function computeDayWindow(
  tripType: string,
  dayIdx: number,
  dayCount: number,
  startDateTime: Date | null,
  endDateTime: Date | null,
  paceLevel: PaceLevel,
  inputStartTime: string | null,
  inputEndTime: string | null
): { dayStartMins: number; dayEndMins: number } {
  let dayStartMins = DAY_START_BY_PACE[paceLevel];
  let dayEndMins = 18 * 60; // 6 PM default

  if (tripType === TripType.PICNIC) {
    dayStartMins = 10 * 60;
    dayEndMins = 16 * 60;
  }

  if (startDateTime && endDateTime) {
    if (dayCount === 1) {
      if (inputStartTime) {
        dayStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
      }
      if (inputEndTime) {
        dayEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
      }
    } else if (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND) {
      if (dayIdx === 0) {
        dayStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
      } else {
        dayStartMins = 8 * 60; // Morning default
      }

      if (dayIdx === dayCount - 1) {
        dayEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
      } else {
        dayEndMins = 22 * 60; // Late evening default
      }
    } else {
      // MULTI_DAY: Keep pre-Phase-2 uniform full-day behavior.
      dayStartMins = DAY_START_BY_PACE[paceLevel];
      dayEndMins = 18 * 60; 
    }
  } else {
    if (inputStartTime) {
      const [h, m] = inputStartTime.split(':').map(Number);
      if (dayCount === 1 || (dayIdx === 0 && (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND))) {
        dayStartMins = h * 60 + m;
      }
    }
    if (inputEndTime) {
      const [h, m] = inputEndTime.split(':').map(Number);
      if (dayCount === 1 || (dayIdx === dayCount - 1 && (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND))) {
        dayEndMins = h * 60 + m;
      }
    }
  }

  return { dayStartMins, dayEndMins };
}

// ── Deterministic fallback ─────────────────────────────────────────────────────


/**
 * Generate a database-grounded itinerary deterministically when Gemini is
 * unavailable or its response fails validation.
 *
 * B-002: Uses variable slot sizes based on place durationMinutes.
 * B-002 Opening Hours: Items that exceed their closingTime are dropped.
 */
function deterministicFallback(
  candidates: CandidatePlace[],
  dayCount: number,
  slotsPerDay: number,
  paceLevel: PaceLevel,
  startDate: Date | null,
  travelSegments: Record<string, string>[] | undefined,
  tripType: string,
  startDateTime: Date | null,
  endDateTime: Date | null,
  inputStartTime: string | null,
  inputEndTime: string | null
): GeneratedDay[] {
  const totalSlotsNeeded = dayCount * slotsPerDay;

  // Build a pool from candidates, do not repeat
  const pool: CandidatePlace[] = [...candidates];

  const days: GeneratedDay[] = [];
  let poolIdx = 0;

  for (let d = 0; d < dayCount; d++) {
    let { dayStartMins, dayEndMins } = computeDayWindow(
      tripType,
      d,
      dayCount,
      startDateTime,
      endDateTime,
      paceLevel,
      inputStartTime,
      inputEndTime
    );

    let date: Date;
    // Apply exact times if available for the specific day
    if (startDate) {
      date = new Date(startDate);
      date.setDate(date.getDate() + d);
    } else {
      date = new Date();
      date.setDate(date.getDate() + d);
    }

    // Try to fill slotsPerDay valid items from pool
    const dayPlaces: CandidatePlace[] = [];
    const candidates_tried = new Set<string>();

    while (dayPlaces.length < slotsPerDay && poolIdx < pool.length) {
      const place = pool[poolIdx++];
      // Avoid infinite loops: skip if we've tried this place already this day
      if (candidates_tried.has(place.id) && dayPlaces.length > 0) {
        if (candidates_tried.size >= candidates.length) break; // exhausted all
        continue;
      }
      candidates_tried.add(place.id);
      dayPlaces.push(place);
    }

    // Check travel segments for constraints on this date

    if (travelSegments && travelSegments.length > 0) {
      for (const ts of travelSegments) {
        if (ts.arrivalDate && new Date(ts.arrivalDate).toDateString() === date.toDateString() && ts.arrivalTime) {
          const [h, m] = ts.arrivalTime.split(':').map(Number);
          const arrivalMins = h * 60 + m;
          // buffer 60 mins from arrival
          if (arrivalMins + 60 > dayStartMins) dayStartMins = arrivalMins + 60;
        }
        if (ts.departureDate && new Date(ts.departureDate).toDateString() === date.toDateString() && ts.departureTime) {
          const [h, m] = ts.departureTime.split(':').map(Number);
          const departureMins = h * 60 + m;
          // buffer 60 mins before departure
          if (departureMins - 60 < dayEndMins) dayEndMins = departureMins - 60;
        }
      }
    }

    const slots = buildTimeSlotsForPlaces(dayPlaces, paceLevel, dayStartMins, dayEndMins);

    const items = dayPlaces
      .map((place, slotIdx) => {
        const slot = slots[slotIdx];
        if (!slot) {
          // This item violates opening hours — drop it
          console.log(`[TripBrain] Dropping ${place.name}: would exceed closing time`);
          return null;
        }
        const { cost, source } = resolveItemCost(place);
        return {
          placeId: place.id,
          title: place.name,
          description: place.description ?? `Visit ${place.name}${place.area ? ` in ${place.area}` : ""}`,
          category: place.category,
          startTime: slot.start,
          endTime: slot.end,
          estimatedCostInr: cost,
          costSource: source,
          lat: place.lat,
          lng: place.lng,
          reasoning: "Deterministic selection from known places for this destination",
          order: slotIdx + 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      // Re-assign order after filtering
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    days.push({ dayNumber: d + 1, date, items });
  }

  return days;
}

// ── Accessibility requirement derivation ─────────────────────────────────────

export type AccessibilityRequirement = "none" | "low_walking" | "wheelchair" | "senior" | "child";

/**
 * Derive a structured accessibility requirement from free-text accessibility notes.
 * Used to deterministically filter candidates in getCandidatePlaces.
 */
export function deriveAccessibilityRequirement(notes: string | undefined): AccessibilityRequirement {
  if (!notes || !notes.trim()) return "none";
  const lower = notes.toLowerCase();
  if (lower.includes("wheelchair")) return "wheelchair";
  if (lower.includes("low walk") || lower.includes("low-walk") || lower.includes("minimal walk")) return "low_walking";
  if (lower.includes("senior") || lower.includes("elderly")) return "senior";
  if (lower.includes("child") || lower.includes("kids") || lower.includes("toddler") || lower.includes("baby")) return "child";
  return "none";
}

// ── Main entry point ───────────────────────────────────────────────────────────

export type TripBrainResult = {
  days: GeneratedDay[];
  resolvedDestination: ResolvedDestination;
  candidateCount: number;
  usedGemini: boolean;
  usedFallback: boolean;
  season: ReturnType<typeof deriveSeason>;
  conflicts: ReturnType<typeof detectPreferenceConflicts>;
  unscheduledMustVisits?: { placeId: string; name: string; reason: string }[];
};

export async function generateGroundedItinerary(
  input: TripBrainInput,
): Promise<TripBrainResult> {
  const dayCount = getTripDuration(input, 3);

  const { startDateTime, endDateTime } = getTripStartEndDateTimes(input);
  
  let availableHours = 0;
  if (startDateTime && endDateTime) {
    availableHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
  } else {
    if (input.tripType === TripType.PICNIC) availableHours = 6;
    else if (input.tripType === TripType.DAY_TRIP) availableHours = 12;
    else availableHours = dayCount * 10; // rough default for MULTI_DAY
  }

  let slotsPerDay = SLOTS_PER_DAY[input.paceLevel];
  if (input.tripType === TripType.PICNIC || input.tripType === TripType.DAY_TRIP) {
    // Dynamic slots based on available hours. (Assume full day is ~10 active hours)
    slotsPerDay = Math.max(1, Math.round((availableHours / 10) * SLOTS_PER_DAY[input.paceLevel]));
    
    if (input.tripType === TripType.DAY_TRIP) {
      slotsPerDay = Math.min(slotsPerDay, SLOTS_PER_DAY[input.paceLevel]);
    } else {
      // PICNIC max 3 slots even if they gave 8 hours
      slotsPerDay = Math.min(slotsPerDay, 3);
    }
  }

  // F-003: Derive season from trip dates
  const season = deriveSeason(input.startDate);
  console.log(`[TripBrain] trip season: ${season}`);

  // Step 1: Resolve destination(s) — try primary first, then waypoints if primary fails.
  // For multi-destination trips, pool candidates from ALL resolvable stops.
  let resolved = await resolveDestination(input.destination);

  // If primary destination can't be resolved, try waypoints in order
  const allStops = [input.destination, ...(input.waypoints ?? [])];
  if (!resolved && allStops.length > 1) {
    for (const stop of allStops.slice(1)) {
      resolved = await resolveDestination(stop);
      if (resolved) {
        console.log(`[TripBrain] primary destination unresolvable, using waypoint: ${stop}`);
        break;
      }
    }
  }

  if (!resolved) {
    throw new DestinationNotFoundError(input.destination);
  }

  console.log(`[TripBrain] destination resolved: ${resolved.name}, ${resolved.state} (${resolved.matchType})`);

  // Step 2: Derive accessibility requirement from notes (B-003)
  const accessibilityRequirement = deriveAccessibilityRequirement(input.accessibilityNotes);
  if (accessibilityRequirement !== "none") {
    console.log(`[TripBrain] accessibility requirement: ${accessibilityRequirement}`);
  }

  // Step 3: Retrieve candidate places from ALL resolvable destinations (pooled for multi-stop trips)
  const budgetPerDay = Math.floor(input.budgetInr / dayCount);

  // Resolve additional waypoint destinations and pool their candidates
  const waypointDestinations: typeof resolved[] = [];
  if (input.waypoints && input.waypoints.length > 0) {
    for (const stop of input.waypoints) {
      const wp = await resolveDestination(stop);
      if (wp && wp.id !== resolved.id) {
        waypointDestinations.push(wp);
        console.log(`[TripBrain] waypoint resolved: ${wp.name}, ${wp.state}`);
      }
    }
  }

  const candidateArgs = {
    allPreferences: input.allPreferences,
    budgetPerDayInr: budgetPerDay,
    season: season === "unknown" ? undefined : season,
    limit: 35,
    accessibilityRequirement: accessibilityRequirement !== "none" ? accessibilityRequirement : undefined,
  };

  const primaryCandidates = await getCandidatePlaces({ destinationId: resolved.id, ...candidateArgs });

  // Pool candidates from all waypoint destinations (up to limit each)
  const waypointCandidates: CandidatePlace[] = [];
  for (const wp of waypointDestinations) {
    const wpCandidates = await getCandidatePlaces({
      destinationId: wp.id,
      ...candidateArgs,
      limit: Math.max(10, Math.floor(35 / (waypointDestinations.length + 1))),
    });
    waypointCandidates.push(...wpCandidates);
  }

  // Deduplicate by placeId
  const seenIds = new Set(primaryCandidates.map(c => c.id));
  const candidates = [
    ...primaryCandidates,
    ...waypointCandidates.filter(c => !seenIds.has(c.id)),
  ];

  console.log(`[TripBrain] candidates retrieved: ${candidates.length} places (season: ${season}, accessibility: ${accessibilityRequirement})`);

  if (candidates.length === 0) {
    throw new DestinationDataError(resolved.name);
  }

  const conflicts = detectPreferenceConflicts(input.allPreferences);
  const hardExclusions = getHardExclusions(input.allPreferences);
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  // Step 3: Try Gemini synthesis
  const hasGemini = !!process.env.GEMINI_API_KEY;
  let days: GeneratedDay[] | null = null;
  let usedGemini = false;

  if (hasGemini) {
    try {
      const prompt = buildGroundedPrompt(
        resolved,
        dayCount,
        slotsPerDay,
        input.budgetInr,
        input.paceLevel,
        season,
        candidates,
        input.allPreferences,
        input.accessibilityNotes,
        input.timeStatus,
        input.travelSegments,
        input.accommodations,
      );

      console.log(`[TripBrain] calling Gemini with ${candidates.length} candidates`);

      const result = await AIGateway.generateText({
        prompt,
        context: { task: "trip_planning" },
      });
      const rawText = result.text;

      if (!rawText.trim()) {
        throw new AIGatewayError("Trip Brain returned empty response", "AI_PROVIDER_ERROR", true);
      }

      // Parse and validate — placeIds must be in candidate set
      const rawDays = parseGeminiResponse(rawText, dayCount, slotsPerDay);
      validateGroundedResponse(rawDays, candidateMap, hardExclusions);

      // Bulk verify placeIds against DB as final ground truth check
      const allPlaceIds = rawDays.flatMap((d) => d.items.map((i) => i.placeId));
      const { verified, unknown } = await bulkVerifyPlaces(allPlaceIds, resolved.id);
      if (unknown.length > 0) {
        throw new AIGatewayError(
          `DB verification failed — unknown placeIds: ${unknown.join(", ")}`,
          "AI_INVALID_OUTPUT"
        );
      }

      // Map to GeneratedDay with:
      // - Real coordinates from DB (not AI-fabricated)
      // - B-001: Authoritative costs from DB (not AI-estimated)
      // - B-002: Variable time slots based on actual durationMinutes
      // - B-002 Opening Hours: Items exceeding closingTime are dropped
      days = rawDays.map((rawDay, dayIdx) => {
        const date = startDateTime ? new Date(startDateTime) : (input.startDate ? new Date(input.startDate) : new Date());
        date.setDate(date.getDate() + dayIdx);

        // Build variable slots for this day's actual selected places (B-002)
        const dayPlaces = rawDay.items.map((item) => candidateMap.get(item.placeId)!);

        let { dayStartMins, dayEndMins } = computeDayWindow(
          input.tripType,
          dayIdx,
          dayCount,
          startDateTime,
          endDateTime,
          input.paceLevel,
          input.startTime || null,
          input.endTime || null
        );

        // Check travel segments for constraints on this date
        if (input.travelSegments && input.travelSegments.length > 0) {
          for (const ts of input.travelSegments) {
            if (ts.arrivalDate && new Date(ts.arrivalDate).toDateString() === date.toDateString() && ts.arrivalTime) {
              const [h, m] = ts.arrivalTime.split(':').map(Number);
              const arrivalMins = h * 60 + m;
              // buffer 60 mins from arrival
              if (arrivalMins + 60 > dayStartMins) dayStartMins = arrivalMins + 60;
            }
            if (ts.departureDate && new Date(ts.departureDate).toDateString() === date.toDateString() && ts.departureTime) {
              const [h, m] = ts.departureTime.split(':').map(Number);
              const departureMins = h * 60 + m;
              // buffer 60 mins before departure
              if (departureMins - 60 < dayEndMins) dayEndMins = departureMins - 60;
            }
          }
        }
        
        const slots = buildTimeSlotsForPlaces(dayPlaces, input.paceLevel, dayStartMins, dayEndMins);

        const items = rawDay.items
          .map((item, slotIdx) => {
            const slot = slots[slotIdx];
            if (!slot) {
              // Opening hours violation: Gemini scheduled this outside closing time
              const candidate = candidateMap.get(item.placeId)!;
              console.log(`[TripBrain] Dropping Gemini-selected ${candidate.name}: exceeds closing time`);
              return null;
            }
            const place = verified.get(item.placeId)!;
            const candidate = candidateMap.get(item.placeId)!;

            // B-001: DB cost takes precedence over AI estimate
            const { cost, source } = resolveItemCost(candidate);

            return {
              placeId: item.placeId,
              title: place.name,
              description: candidate.description ?? `Visit ${place.name}`,
              category: place.category,
              startTime: slot.start,
              endTime: slot.end,
              estimatedCostInr: cost,
              costSource: source,
              lat: place.lat,
              lng: place.lng,
              reasoning: item.reasoning,
              order: slotIdx + 1,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map((item, idx) => ({ ...item, order: idx + 1 }));

        return {
          dayNumber: rawDay.dayNumber,
          date,
          items,
        };
      });


      usedGemini = true;
      console.log(`[TripBrain] Gemini response validated and cost-corrected successfully`);
    } catch (err) {
      if (
        err instanceof DestinationNotFoundError ||
        err instanceof DestinationDataError ||
        err instanceof ValidationError
      ) {
        throw err;
      }
      // AI errors → fall through to deterministic fallback
      console.log(
        `[TripBrain] AI failed (${err instanceof Error ? err.message : String(err)}), using deterministic fallback`,
      );
    }
  }

  if (!days) {
    console.log(`[TripBrain] generating deterministic fallback itinerary`);
    
    days = deterministicFallback(
      candidates, 
      dayCount, 
      slotsPerDay, 
      input.paceLevel, 
      input.startDate, 
      input.travelSegments,
      input.tripType,
      startDateTime,
      endDateTime,
      input.startTime || null,
      input.endTime || null
    );
  }

  // Step 5: Enforce strict budget limit (B-001)
  days = enforceBudget(days, input.budgetInr, input.maxTravelers);

  return {
    days,
    resolvedDestination: resolved,
    candidateCount: candidates.length,
    usedGemini,
    usedFallback: !usedGemini,
    season,
    conflicts,
  };
}

function enforceBudget(days: GeneratedDay[], budgetInr: number, maxTravelers: number): GeneratedDay[] {
  let totalCost = 0;
  for (const day of days) {
    for (const item of day.items) {
      totalCost += (item.estimatedCostInr ?? 0) * maxTravelers;
    }
  }

  if (totalCost <= budgetInr) return days;

  console.log(`[TripBrain] Enforcing budget: ${totalCost} > ${budgetInr}. Dropping expensive items.`);

  const flatItems = days.flatMap(d => d.items.map(i => ({ ...i, dayNumber: d.dayNumber })));
  flatItems.sort((a, b) => (b.estimatedCostInr ?? 0) - (a.estimatedCostInr ?? 0));

  const toDrop = new Set<string>();
  
  for (const item of flatItems) {
    if (totalCost <= budgetInr) break;
    if (!item.estimatedCostInr || item.estimatedCostInr === 0) continue;
    
    totalCost -= item.estimatedCostInr * maxTravelers;
    toDrop.add(`${item.dayNumber}-${item.order}`);
  }

  return days.map(d => ({
    ...d,
    items: d.items.filter(i => !toDrop.has(`${d.dayNumber}-${i.order}`))
  }));
}
