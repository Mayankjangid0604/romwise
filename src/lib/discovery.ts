import { z } from "zod";
import { AIGateway } from "./ai/gateway";
import { AIGatewayError } from "./ai/types";

export const destinationSuggestionSchema = z.object({
  name: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  climate: z.string().trim().min(1),
  bestTravelTime: z.string().trim().min(1),
  suggestedBudgetLevel: z.enum(["Budget", "Mid-range", "Luxury"]),
  activities: z.array(z.string().trim().min(1)).min(1).max(5),
  matchScore: z.number().min(0).max(100).transform(Math.round)
});

export const discoveryResponseSchema = z.object({
  destinations: z.array(destinationSuggestionSchema).length(3)
});

export type DestinationSuggestion = z.infer<typeof destinationSuggestionSchema>;
export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;

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
  const result = discoveryResponseSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Invalid AI response: ${result.error.message}`);
  }
  return result.data;
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
  const result = await AIGateway.generateStructured<unknown>({
    prompt: `${DISCOVERY_PROMPT}\n\nTrip description: ${input.description}`,
    context: { task: "destination_discovery" },
  });

  try {
    return validateDiscoveryResponse(result.data);
  } catch (error) {
    throw new AIGatewayError("Failed to validate discovery response", "AI_INVALID_OUTPUT", false);
  }
}

// ── Destination Detail ────────────────────────────────────────────────────────

export const mustVisitPlaceSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  bestFor: z.string().trim().min(1),
  tipForVisiting: z.string().trim().min(1)
});

export const destinationDetailsSchema = z.object({
  name: z.string().trim().min(1),
  tagline: z.string().trim().min(1),
  overview: z.string().trim().min(1),
  vibe: z.string().trim().min(1),
  bestMonths: z.array(z.string().trim().min(1)).min(2).max(4),
  suggestedDays: z.object({ min: z.number().min(1), max: z.number().min(1) }),
  mustVisitPlaces: z.array(mustVisitPlaceSchema).min(4).max(6),
  localCuisine: z.array(z.string().trim().min(1)).min(3).max(5),
  practicalTips: z.array(z.string().trim().min(1)).min(3).max(5),
  budgetLevelLabel: z.enum(["Budget", "Mid-range", "Luxury"]),
  averageDailyBudgetInr: z.number().min(0)
});

export type MustVisitPlace = z.infer<typeof mustVisitPlaceSchema>;
export type DestinationDetails = z.infer<typeof destinationDetailsSchema>;

const DESTINATION_DETAILS_PROMPT = `You are an expert travel writer. Given a destination name, produce a rich, accurate travel guide.

Respond with ONLY valid JSON matching this exact structure (no markdown, no code fences, no extra text):
{
  "name": "Full destination name",
  "tagline": "A punchy one-line tagline for the destination",
  "overview": "2-3 sentences describing the destination — geography, character, why people love it",
  "vibe": "1-2 sentences capturing the emotional feel and atmosphere of the place",
  "bestMonths": ["October", "November"],
  "suggestedDays": { "min": 3, "max": 7 },
  "mustVisitPlaces": [
    {
      "name": "Place name",
      "category": "e.g. Temple / Lake / Market / Viewpoint / Trek",
      "description": "What it is and why it matters",
      "bestFor": "Who this place is ideal for",
      "tipForVisiting": "A practical tip for visiting"
    }
  ],
  "localCuisine": ["Dish 1", "Dish 2", "up to 5 items"],
  "practicalTips": ["Tip 1", "Tip 2", "up to 5 tips"],
  "budgetLevelLabel": "Mid-range",
  "averageDailyBudgetInr": 3000
}

Rules:
- mustVisitPlaces: 4-6 items
- localCuisine: 3-5 items
- practicalTips: 3-5 practical, traveler-specific tips
- budgetLevelLabel: one of "Budget", "Mid-range", "Luxury"
- averageDailyBudgetInr: realistic per-person per-day budget in Indian Rupees
- All string fields must be non-empty
- bestMonths: 2-4 months, short names like "October"`;

export function validateDestinationDetailsResponse(data: unknown): DestinationDetails {
  const result = destinationDetailsSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Invalid destination details response: ${result.error.message}`);
  }
  return result.data;
}

export async function getDestinationDetails(
  destinationName: string,
  context?: string
): Promise<DestinationDetails> {
  const promptExtension = context ? `\n\nContext about why this was suggested: ${context}` : "";

  const result = await AIGateway.generateStructured<DestinationDetails>({
    prompt: `${DESTINATION_DETAILS_PROMPT}\n\nDestination: ${destinationName}${promptExtension}`,
    context: { task: "destination_details" },
  });

  try {
    return validateDestinationDetailsResponse(result.data);
  } catch (error) {
    throw new AIGatewayError("Failed to validate destination details response", "AI_INVALID_OUTPUT", false);
  }
}
