import {
  getGeminiClient,
  GeminiProviderError,
  GeminiSchemaError,
} from "./gemini";

export type DestinationSuggestion = {
  name: string;
  rationale: string;
  climate: string;
  bestTravelTime: string;
  suggestedBudgetLevel: string;
  activities: string[];
  matchScore: number;
};

export type DiscoveryResponse = {
  destinations: [DestinationSuggestion, DestinationSuggestion, DestinationSuggestion];
};

export type DiscoveryInput = {
  description: string;
};

export function validateDiscoveryInput(input: unknown): DiscoveryInput {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.description !== "string" || obj.description.trim().length === 0) {
    throw new ValidationError("description is required and must be a non-empty string");
  }
  if (obj.description.trim().length > 1000) {
    throw new ValidationError("description must be 1000 characters or fewer");
  }
  return { description: obj.description.trim() };
}

export function validateDiscoveryResponse(data: unknown): DiscoveryResponse {
  if (!data || typeof data !== "object") {
    throw new GeminiSchemaError("AI response is not an object");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.destinations)) {
    throw new GeminiSchemaError("AI response missing 'destinations' array");
  }

  if (obj.destinations.length !== 3) {
    throw new GeminiSchemaError(
      `Expected exactly 3 destinations, got ${obj.destinations.length}`,
    );
  }

  const destinations = obj.destinations.map((d: unknown, i: number) => {
    if (!d || typeof d !== "object") {
      throw new GeminiSchemaError(`Destination ${i} is not an object`);
    }
    const dest = d as Record<string, unknown>;

    const requiredStrings = [
      "name",
      "rationale",
      "climate",
      "bestTravelTime",
      "suggestedBudgetLevel",
    ] as const;

    for (const field of requiredStrings) {
      if (typeof dest[field] !== "string" || (dest[field] as string).trim().length === 0) {
        throw new GeminiSchemaError(
          `Destination ${i}: '${field}' must be a non-empty string`,
        );
      }
    }

    if (!Array.isArray(dest.activities)) {
      throw new GeminiSchemaError(
        `Destination ${i}: 'activities' must be an array`,
      );
    }
    if (dest.activities.length === 0 || dest.activities.length > 5) {
      throw new GeminiSchemaError(
        `Destination ${i}: 'activities' must have 1-5 items`,
      );
    }
    for (let j = 0; j < dest.activities.length; j++) {
      if (
        typeof dest.activities[j] !== "string" ||
        (dest.activities[j] as string).trim().length === 0
      ) {
        throw new GeminiSchemaError(
          `Destination ${i}: activity ${j} must be a non-empty string`,
        );
      }
    }

    if (typeof dest.matchScore !== "number") {
      throw new GeminiSchemaError(
        `Destination ${i}: 'matchScore' must be a number`,
      );
    }
    if (dest.matchScore < 0 || dest.matchScore > 100) {
      throw new GeminiSchemaError(
        `Destination ${i}: 'matchScore' must be 0-100`,
      );
    }

    return {
      name: (dest.name as string).trim(),
      rationale: (dest.rationale as string).trim(),
      climate: (dest.climate as string).trim(),
      bestTravelTime: (dest.bestTravelTime as string).trim(),
      suggestedBudgetLevel: (dest.suggestedBudgetLevel as string).trim(),
      activities: (dest.activities as string[]).map((a) => a.trim()),
      matchScore: Math.round(dest.matchScore as number),
    };
  });

  return { destinations: destinations as DiscoveryResponse["destinations"] };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const DISCOVERY_PROMPT = `You are a travel destination expert. Given a natural-language trip description, suggest exactly 3 destination options.

Respond with ONLY valid JSON matching this exact structure (no markdown, no code fences, no extra text):
{
  "destinations": [
    {
      "name": "Destination Name, Country",
      "rationale": "Why this destination matches the request",
      "climate": "Expected weather/climate during travel period",
      "bestTravelTime": "Best months to visit",
      "suggestedBudgetLevel": "Budget/Mid-range/Luxury",
      "activities": ["activity 1", "activity 2", "up to 5"],
      "matchScore": 85
    }
  ]
}

Rules:
- Exactly 3 destinations, no more, no less
- matchScore is 0-100 indicating how well this destination matches the description
- activities array has 1-5 items
- All string fields must be non-empty
- suggestedBudgetLevel must be one of: Budget, Mid-range, Luxury
- Consider the traveler count, interests, timeframe, and any constraints mentioned`;

export async function discoverDestinations(
  input: DiscoveryInput,
): Promise<DiscoveryResponse> {
  const client = getGeminiClient();

  let rawText: string;
  try {
    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `${DISCOVERY_PROMPT}\n\nTrip description: ${input.description}`,
    });
    rawText = response.text ?? "";
  } catch (error) {
    throw new GeminiProviderError(
      `Gemini API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!rawText.trim()) {
    throw new GeminiProviderError("Gemini returned an empty response");
  }

  let parsed: unknown;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new GeminiSchemaError(
      "Gemini response is not valid JSON",
    );
  }

  return validateDiscoveryResponse(parsed);
}
