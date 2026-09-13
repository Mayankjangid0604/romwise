import {
  getGeminiClient,
  GeminiProviderError,
  GeminiSchemaError,
} from "./gemini";
import { ValidationError } from "./discovery";

export type TravelerProfile = {
  name: string;
  pace: "easy" | "balanced" | "full";
  interests: string[];
  priorities: string[];
  foodPreferences: string[];
  accessibility: string[];
};

export type GroupAlignmentInput = {
  travelers: TravelerProfile[];
};

export type GroupAlignmentResponse = {
  coreTension: string;
  compromiseSuggestion: string;
  harmonyScore: number;
};

export function validateGroupAlignmentInput(input: unknown): GroupAlignmentInput {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.travelers)) {
    throw new ValidationError("'travelers' must be an array");
  }
  if (obj.travelers.length < 2) {
    throw new ValidationError("At least 2 traveler profiles are required");
  }
  if (obj.travelers.length > 20) {
    throw new ValidationError("Maximum 20 traveler profiles allowed");
  }

  const travelers = obj.travelers.map((t: unknown, i: number) => {
    if (!t || typeof t !== "object") {
      throw new ValidationError(`Traveler ${i} must be an object`);
    }
    const traveler = t as Record<string, unknown>;

    if (typeof traveler.name !== "string" || traveler.name.trim().length === 0) {
      throw new ValidationError(`Traveler ${i}: 'name' is required`);
    }
    if (!["easy", "balanced", "full"].includes(traveler.pace as string)) {
      throw new ValidationError(
        `Traveler ${i}: 'pace' must be easy, balanced, or full`,
      );
    }

    const stringArrayFields = [
      "interests",
      "priorities",
      "foodPreferences",
      "accessibility",
    ] as const;
    for (const field of stringArrayFields) {
      if (!Array.isArray(traveler[field])) {
        throw new ValidationError(`Traveler ${i}: '${field}' must be an array`);
      }
      for (let j = 0; j < (traveler[field] as unknown[]).length; j++) {
        if (typeof (traveler[field] as unknown[])[j] !== "string") {
          throw new ValidationError(
            `Traveler ${i}: '${field}[${j}]' must be a string`,
          );
        }
      }
    }

    return {
      name: (traveler.name as string).trim(),
      pace: traveler.pace as TravelerProfile["pace"],
      interests: (traveler.interests as string[]).map((s) => s.trim()),
      priorities: (traveler.priorities as string[]).map((s) => s.trim()),
      foodPreferences: (traveler.foodPreferences as string[]).map((s) => s.trim()),
      accessibility: (traveler.accessibility as string[]).map((s) => s.trim()),
    };
  });

  return { travelers };
}

export function validateGroupAlignmentResponse(
  data: unknown,
): GroupAlignmentResponse {
  if (!data || typeof data !== "object") {
    throw new GeminiSchemaError("AI response is not an object");
  }
  const obj = data as Record<string, unknown>;

  if (
    typeof obj.coreTension !== "string" ||
    obj.coreTension.trim().length === 0
  ) {
    throw new GeminiSchemaError(
      "'coreTension' must be a non-empty string",
    );
  }
  if (
    typeof obj.compromiseSuggestion !== "string" ||
    obj.compromiseSuggestion.trim().length === 0
  ) {
    throw new GeminiSchemaError(
      "'compromiseSuggestion' must be a non-empty string",
    );
  }
  if (typeof obj.harmonyScore !== "number") {
    throw new GeminiSchemaError("'harmonyScore' must be a number");
  }
  if (obj.harmonyScore < 0 || obj.harmonyScore > 100) {
    throw new GeminiSchemaError("'harmonyScore' must be 0-100");
  }

  return {
    coreTension: (obj.coreTension as string).trim(),
    compromiseSuggestion: (obj.compromiseSuggestion as string).trim(),
    harmonyScore: Math.round(obj.harmonyScore as number),
  };
}

const GROUP_ALIGNMENT_PROMPT = `You are a group travel harmony analyst. Given profiles of multiple travelers, analyze potential conflicts and suggest compromises.

Respond with ONLY valid JSON matching this exact structure (no markdown, no code fences, no extra text):
{
  "coreTension": "Description of the main tension or conflict between group members' preferences",
  "compromiseSuggestion": "A practical, specific compromise that addresses the core tension",
  "harmonyScore": 72
}

Rules:
- coreTension: describe the biggest source of disagreement between travelers
- compromiseSuggestion: offer a specific, actionable compromise — not vague advice
- harmonyScore: 0-100, where 100 means perfect alignment and 0 means fundamental incompatibility
- All string fields must be non-empty
- Consider pace preferences, interests, food restrictions, and accessibility needs`;

export async function analyzeGroupAlignment(
  input: GroupAlignmentInput,
): Promise<GroupAlignmentResponse> {
  const client = getGeminiClient();

  const profilesSummary = input.travelers
    .map(
      (t) =>
        `- ${t.name}: pace=${t.pace}, interests=[${t.interests.join(", ")}], priorities=[${t.priorities.join(", ")}], food=[${t.foodPreferences.join(", ")}], accessibility=[${t.accessibility.join(", ")}]`,
    )
    .join("\n");

  let rawText: string;
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `${GROUP_ALIGNMENT_PROMPT}\n\nTraveler profiles:\n${profilesSummary}`,
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
    throw new GeminiSchemaError("Gemini response is not valid JSON");
  }

  return validateGroupAlignmentResponse(parsed);
}
