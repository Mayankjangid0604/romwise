import { getGeminiClient, GeminiProviderError, GeminiSchemaError } from "./gemini";

export type PaceLevel = "easy" | "balanced" | "full";

export type TripBrainInput = {
  destination: string;
  destinationState?: string;
  destinationLat?: number;
  destinationLng?: number;
  startDate: Date;
  endDate: Date;
  budgetInr: number;
  paceLevel: PaceLevel;
  preferences: { category: string; priority: string }[];
  accessibilityNotes?: string;
};

export type GeneratedActivity = {
  title: string;
  description: string;
  category: string;
  estimatedCostInr: number;
  reasoning: string;
};

export type GeneratedDay = {
  dayNumber: number;
  date: Date;
  items: {
    title: string;
    description: string;
    category: string;
    startTime: string;
    endTime: string;
    estimatedCostInr: number;
    reasoning: string;
    order: number;
  }[];
};

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

const VALID_CATEGORIES = [
  "dining", "sightseeing", "adventure", "culture",
  "shopping", "relaxation", "nightlife", "nature",
];

function buildPrompt(input: TripBrainInput, dayCount: number): string {
  const slotsPerDay = TIME_SLOTS[input.paceLevel].length;
  const dailyBudget = Math.floor(input.budgetInr / dayCount);

  const prefSummary = input.preferences.length > 0
    ? input.preferences.map((p) => `${p.category}: ${p.priority}`).join(", ")
    : "No specific preferences — balanced variety";

  const locationContext = input.destinationState
    ? `${input.destination}, ${input.destinationState} (India)`
    : `${input.destination} (India)`;

  return `You are a travel planning expert for India. Generate a ${dayCount}-day itinerary for ${locationContext}.

CONTEXT:
- Travel dates: ${input.startDate.toISOString().split("T")[0]} to ${input.endDate.toISOString().split("T")[0]}
- Daily budget: ₹${dailyBudget} (total ₹${input.budgetInr})
- Pace: ${input.paceLevel} (${slotsPerDay} activities per day)
- Traveler preferences: ${prefSummary}
${input.accessibilityNotes ? `- Accessibility needs: ${input.accessibilityNotes}` : ""}

RULES:
- Generate EXACTLY ${slotsPerDay} activities per day, ${dayCount} days total
- Each activity must be a REAL place, restaurant, market, temple, park, beach, or experience that actually exists in or near ${input.destination}
- Do NOT invent fictional places. If you don't know real places in this destination, use well-known landmarks and generic-but-honest activity types (e.g. "Local market near city center" rather than a made-up market name)
- Categories must be one of: ${VALID_CATEGORIES.join(", ")}
- estimatedCostInr must be realistic for Indian travel (entry fees, meal costs, activity costs in INR)
- Each day's total cost should roughly stay within ₹${dailyBudget}
- reasoning should explain why this activity fits the traveler's preferences and schedule
- Include at least one dining activity per day
- Vary categories across days — don't repeat the same activity type consecutively

Respond with ONLY valid JSON matching this structure (no markdown, no code fences):
{
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "title": "Specific Place or Activity Name",
          "description": "What the traveler will do here",
          "category": "one of the valid categories",
          "estimatedCostInr": 500,
          "reasoning": "Why this activity and why at this time"
        }
      ]
    }
  ]
}`;
}

type RawDay = {
  dayNumber: number;
  activities: {
    title: string;
    description: string;
    category: string;
    estimatedCostInr: number;
    reasoning: string;
  }[];
};

function validateResponse(data: unknown, dayCount: number, slotsPerDay: number): RawDay[] {
  if (!data || typeof data !== "object") {
    throw new GeminiSchemaError("Response is not an object");
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.days)) {
    throw new GeminiSchemaError("Response missing 'days' array");
  }

  if (obj.days.length !== dayCount) {
    throw new GeminiSchemaError(`Expected ${dayCount} days, got ${obj.days.length}`);
  }

  return obj.days.map((day: unknown, i: number) => {
    if (!day || typeof day !== "object") {
      throw new GeminiSchemaError(`Day ${i} is not an object`);
    }
    const d = day as Record<string, unknown>;

    if (!Array.isArray(d.activities)) {
      throw new GeminiSchemaError(`Day ${i} missing 'activities' array`);
    }

    if (d.activities.length !== slotsPerDay) {
      throw new GeminiSchemaError(
        `Day ${i}: expected ${slotsPerDay} activities, got ${d.activities.length}`,
      );
    }

    const activities = d.activities.map((act: unknown, j: number) => {
      if (!act || typeof act !== "object") {
        throw new GeminiSchemaError(`Day ${i} activity ${j} is not an object`);
      }
      const a = act as Record<string, unknown>;

      if (typeof a.title !== "string" || !a.title.trim()) {
        throw new GeminiSchemaError(`Day ${i} activity ${j}: title required`);
      }
      if (typeof a.description !== "string" || !a.description.trim()) {
        throw new GeminiSchemaError(`Day ${i} activity ${j}: description required`);
      }
      if (typeof a.category !== "string" || !VALID_CATEGORIES.includes(a.category)) {
        throw new GeminiSchemaError(
          `Day ${i} activity ${j}: category must be one of ${VALID_CATEGORIES.join(", ")}`,
        );
      }
      if (typeof a.estimatedCostInr !== "number" || a.estimatedCostInr < 0) {
        throw new GeminiSchemaError(`Day ${i} activity ${j}: estimatedCostInr must be non-negative`);
      }

      return {
        title: (a.title as string).trim(),
        description: (a.description as string).trim(),
        category: a.category as string,
        estimatedCostInr: Math.round(a.estimatedCostInr as number),
        reasoning: typeof a.reasoning === "string" ? a.reasoning.trim() : "",
      };
    });

    return {
      dayNumber: i + 1,
      activities,
    };
  });
}

export async function generateTripBrainItinerary(input: TripBrainInput): Promise<GeneratedDay[]> {
  const dayCount = Math.ceil(
    (input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;

  const slots = TIME_SLOTS[input.paceLevel];
  const prompt = buildPrompt(input, dayCount);

  const client = getGeminiClient();

  let rawText: string;
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    rawText = response.text ?? "";
  } catch (error) {
    throw new GeminiProviderError(
      `Trip Brain API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!rawText.trim()) {
    throw new GeminiProviderError("Trip Brain returned an empty response");
  }

  let parsed: unknown;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new GeminiSchemaError("Trip Brain response is not valid JSON");
  }

  const rawDays = validateResponse(parsed, dayCount, slots.length);

  return rawDays.map((day, dayIdx) => {
    const date = new Date(input.startDate);
    date.setDate(date.getDate() + dayIdx);

    return {
      dayNumber: day.dayNumber,
      date,
      items: day.activities.map((act, slotIdx) => ({
        title: act.title,
        description: act.description,
        category: act.category,
        startTime: slots[slotIdx].start,
        endTime: slots[slotIdx].end,
        estimatedCostInr: act.estimatedCostInr,
        reasoning: act.reasoning,
        order: slotIdx + 1,
      })),
    };
  });
}
