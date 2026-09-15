/**
 * Trip Brain — grounded itinerary generation pipeline.
 *
 * Pipeline:
 * 1. Resolve destination → TravelDestination (error if unknown)
 * 2. Retrieve candidate places (preference-scored, hard exclusions applied)
 * 3. If no candidates → DestinationDataError (no Gemini call)
 * 4. If Gemini available → send candidates to Gemini for synthesis
 * 5. Validate Gemini response → all placeIds must exist in candidate set
 * 6. If Gemini unavailable OR fails → deterministic fallback from candidates
 * 7. Resolve real coordinates from Place records
 * 8. Return grounded GeneratedDay[]
 *
 * LLM role: synthesize and arrange known candidates into a coherent schedule.
 * LLM is NOT the source of truth for place existence, coordinates, or costs.
 */

import { getGeminiClient, GeminiProviderError, GeminiSchemaError } from "./gemini";
import { resolveDestination } from "./destination-resolver";
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
  startDate: Date;
  endDate: Date;
  budgetInr: number;
  paceLevel: PaceLevel;
  allPreferences: MemberPreference[];
  accessibilityNotes?: string;
};

export type GeneratedActivity = {
  placeId: string;
  title: string;
  description: string;
  category: string;
  estimatedCostInr: number;
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
    lat: number | null;
    lng: number | null;
    reasoning: string;
    order: number;
  }[];
};

// ── Time slots ─────────────────────────────────────────────────────────────────

const TIME_SLOTS: Record<PaceLevel, { start: string; end: string }[]> = {
  easy: [
    { start: "09:00", end: "10:30" },
    { start: "11:00", end: "12:30" },
    { start: "13:30", end: "15:00" },
    { start: "16:00", end: "17:30" },
  ],
  balanced: [
    { start: "08:00", end: "09:30" },
    { start: "10:00", end: "11:30" },
    { start: "12:00", end: "13:30" },
    { start: "14:30", end: "16:00" },
    { start: "16:30", end: "18:00" },
    { start: "19:00", end: "20:30" },
  ],
  full: [
    { start: "07:00", end: "08:30" },
    { start: "09:00", end: "10:30" },
    { start: "11:00", end: "12:30" },
    { start: "13:00", end: "14:30" },
    { start: "15:00", end: "16:30" },
    { start: "17:00", end: "18:30" },
    { start: "19:00", end: "20:30" },
    { start: "21:00", end: "22:30" },
  ],
};

// ── Gemini prompt + response types ────────────────────────────────────────────

function buildGroundedPrompt(
  destination: ResolvedDestination,
  dayCount: number,
  slotsPerDay: number,
  budgetInr: number,
  paceLevel: PaceLevel,
  candidates: CandidatePlace[],
  allPreferences: MemberPreference[],
  accessibilityNotes?: string,
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
    typicalCostInr: c.typicalCostInr ?? "unknown",
    durationMinutes: c.durationMinutes ?? undefined,
    openingTime: c.openingTime ?? undefined,
    closingTime: c.closingTime ?? undefined,
    description: c.description ?? undefined,
    preferenceScore: c.preferenceScore,
  }));

  return `You are a travel itinerary planner. Arrange the provided candidate places into a ${dayCount}-day itinerary for ${destination.name}, ${destination.state}.

TRIP CONTEXT:
- Days: ${dayCount}
- Activities per day: ${slotsPerDay} (${paceLevel} pace)
- Total budget: ₹${budgetInr} (~₹${dailyBudget}/day for activities)
${accessibilityNotes ? `- Accessibility needs: ${accessibilityNotes}` : ""}

TRAVELER PREFERENCES:
${prefLines.length > 0 ? prefLines.join("\n") : "  No specific preferences"}
${conflicts.length > 0 ? `\nPREFERENCE CONFLICTS RESOLVED:\n${conflicts.map((c) => `  ${c.resolution}`).join("\n")}` : ""}

CANDIDATE PLACES (select ONLY from this list):
${JSON.stringify(candidateJson, null, 2)}

RULES:
- Select ONLY places from the candidate list above using their exact "id" values
- Do NOT invent new places or use place IDs not in the list
- Aim for variety across days — distribute categories across the itinerary
- Each day should include at least one dining/food activity if a dining candidate is available
- Hard exclusions must not appear (marked above)
- Keep each day's total estimated cost under ₹${dailyBudget}
- If a place has durationMinutes, use that to inform scheduling
- Spread activities geographically when candidates span different areas
- A place MAY appear more than once across different days only if the candidate list is very small

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "days": [
    {
      "dayNumber": 1,
      "items": [
        {
          "placeId": "<exact id from candidate list>",
          "estimatedCostInr": 200,
          "reasoning": "Why this place at this time"
        }
      ]
    }
  ]
}

Generate exactly ${slotsPerDay} items per day, ${dayCount} days total.`;
}

// ── Gemini response validation ─────────────────────────────────────────────────

type GeminiRawItem = {
  placeId: string;
  estimatedCostInr: number;
  reasoning: string;
};

type GeminiRawDay = {
  dayNumber: number;
  items: GeminiRawItem[];
};

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
    throw new GeminiSchemaError("Trip Brain response is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new GeminiSchemaError("Trip Brain response is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.days)) {
    throw new GeminiSchemaError("Trip Brain response missing 'days' array");
  }
  if (obj.days.length !== expectedDays) {
    throw new GeminiSchemaError(`Expected ${expectedDays} days, got ${obj.days.length}`);
  }

  return obj.days.map((day: unknown, i: number) => {
    if (!day || typeof day !== "object") {
      throw new GeminiSchemaError(`Day ${i} is not an object`);
    }
    const d = day as Record<string, unknown>;
    if (!Array.isArray(d.items)) {
      throw new GeminiSchemaError(`Day ${i} missing items array`);
    }
    if (d.items.length !== expectedItemsPerDay) {
      throw new GeminiSchemaError(
        `Day ${i}: expected ${expectedItemsPerDay} items, got ${d.items.length}`,
      );
    }

    const items: GeminiRawItem[] = d.items.map((item: unknown, j: number) => {
      if (!item || typeof item !== "object") {
        throw new GeminiSchemaError(`Day ${i} item ${j} is not an object`);
      }
      const a = item as Record<string, unknown>;
      if (typeof a.placeId !== "string" || !a.placeId.trim()) {
        throw new GeminiSchemaError(`Day ${i} item ${j}: placeId must be a non-empty string`);
      }
      if (typeof a.estimatedCostInr !== "number" || a.estimatedCostInr < 0) {
        throw new GeminiSchemaError(`Day ${i} item ${j}: estimatedCostInr must be a non-negative number`);
      }
      return {
        placeId: (a.placeId as string).trim(),
        estimatedCostInr: Math.round(a.estimatedCostInr as number),
        reasoning: typeof a.reasoning === "string" ? a.reasoning.trim() : "",
      };
    });

    return { dayNumber: i + 1, items };
  });
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
        throw new ValidationError(
          `Day ${day.dayNumber}: placeId "${item.placeId}" is not in the candidate list. Rejecting response.`,
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

// ── Deterministic fallback ─────────────────────────────────────────────────────

/**
 * Generate a database-grounded itinerary deterministically when Gemini is
 * unavailable or its response fails validation.
 *
 * Approach:
 * - Spread candidates across days, prioritizing higher-scored places
 * - Ensure variety: different categories across consecutive slots where possible
 * - Each place used at most once unless candidates are insufficient
 */
function deterministicFallback(
  candidates: CandidatePlace[],
  dayCount: number,
  slots: { start: string; end: string }[],
  startDate: Date,
): GeneratedDay[] {
  const slotsPerDay = slots.length;
  const totalSlots = dayCount * slotsPerDay;

  // Repeat candidates if there aren't enough to fill all slots
  const pool: CandidatePlace[] = [];
  while (pool.length < totalSlots) {
    pool.push(...candidates);
  }
  // Keep only what we need, maintain preference ordering
  pool.length = totalSlots;

  const days: GeneratedDay[] = [];
  let idx = 0;

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    const items = slots.map((slot, slotIdx) => {
      const place = pool[idx++];
      return {
        placeId: place.id,
        title: place.name,
        description: place.description ?? `Visit ${place.name}${place.area ? ` in ${place.area}` : ""}`,
        category: place.category,
        startTime: slot.start,
        endTime: slot.end,
        estimatedCostInr: place.typicalCostInr ?? null,
        lat: place.lat,
        lng: place.lng,
        reasoning: "Deterministic selection from known places for this destination",
        order: slotIdx + 1,
      };
    });

    days.push({ dayNumber: d + 1, date, items });
  }

  return days;
}

// ── Main entry point ───────────────────────────────────────────────────────────

export type TripBrainResult = {
  days: GeneratedDay[];
  resolvedDestination: ResolvedDestination;
  candidateCount: number;
  usedGemini: boolean;
  conflicts: ReturnType<typeof detectPreferenceConflicts>;
};

export async function generateGroundedItinerary(
  input: TripBrainInput,
): Promise<TripBrainResult> {
  const dayCount =
    Math.ceil((input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const slots = TIME_SLOTS[input.paceLevel];

  // Step 1: Resolve destination — reject unknown destinations before any AI call
  const resolved = await resolveDestination(input.destination);
  if (!resolved) {
    throw new DestinationNotFoundError(input.destination);
  }

  console.log(`[TripBrain] destination resolved: ${resolved.name}, ${resolved.state} (${resolved.matchType})`);

  // Step 2: Retrieve candidate places (hard exclusions already filtered)
  // input.budgetInr is GROUP_TOTAL (whole trip, all travelers). Divide by days only for per-day budget hints.
  const budgetPerDay = Math.floor(input.budgetInr / dayCount);
  const candidates = await getCandidatePlaces({
    destinationId: resolved.id,
    allPreferences: input.allPreferences,
    budgetPerDayInr: budgetPerDay,
    limit: 30,
  });

  console.log(`[TripBrain] candidates retrieved: ${candidates.length} places`);

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
      const client = getGeminiClient();
      const prompt = buildGroundedPrompt(
        resolved,
        dayCount,
        slots.length,
        input.budgetInr,
        input.paceLevel,
        candidates,
        input.allPreferences,
        input.accessibilityNotes,
      );

      console.log(`[TripBrain] calling Gemini with ${candidates.length} candidates`);

      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });
      const rawText = response.text ?? "";

      if (!rawText.trim()) {
        throw new GeminiProviderError("Trip Brain returned empty response");
      }

      // Parse and validate — placeIds must be in candidate set
      const rawDays = parseGeminiResponse(rawText, dayCount, slots.length);
      validateGroundedResponse(rawDays, candidateMap, hardExclusions);

      // Bulk verify placeIds against DB as final ground truth check
      const allPlaceIds = rawDays.flatMap((d) => d.items.map((i) => i.placeId));
      const { verified, unknown } = await bulkVerifyPlaces(allPlaceIds, resolved.id);
      if (unknown.length > 0) {
        throw new ValidationError(
          `DB verification failed — unknown placeIds: ${unknown.join(", ")}`,
        );
      }

      // Map to GeneratedDay with real coordinates from DB
      days = rawDays.map((rawDay, dayIdx) => {
        const date = new Date(input.startDate);
        date.setDate(date.getDate() + dayIdx);

        return {
          dayNumber: rawDay.dayNumber,
          date,
          items: rawDay.items.map((item, slotIdx) => {
            const place = verified.get(item.placeId)!;
            const candidate = candidateMap.get(item.placeId)!;
            return {
              placeId: item.placeId,
              title: place.name,
              description: candidate.description ?? `Visit ${place.name}`,
              category: place.category,
              startTime: slots[slotIdx].start,
              endTime: slots[slotIdx].end,
              estimatedCostInr: item.estimatedCostInr,
              lat: place.lat,
              lng: place.lng,
              reasoning: item.reasoning,
              order: slotIdx + 1,
            };
          }),
        };
      });

      usedGemini = true;
      console.log(`[TripBrain] Gemini response validated successfully`);
    } catch (err) {
      if (
        err instanceof DestinationNotFoundError ||
        err instanceof DestinationDataError ||
        err instanceof ValidationError
      ) {
        throw err;
      }
      // Gemini provider/schema errors → fall through to deterministic fallback
      console.log(
        `[TripBrain] Gemini failed (${err instanceof Error ? err.message : String(err)}), using deterministic fallback`,
      );
    }
  }

  // Step 4: Deterministic fallback when Gemini unavailable or failed
  if (!days) {
    console.log(`[TripBrain] generating deterministic fallback itinerary`);
    days = deterministicFallback(candidates, dayCount, slots, input.startDate);
  }

  return {
    days,
    resolvedDestination: resolved,
    candidateCount: candidates.length,
    usedGemini,
    conflicts,
  };
}
