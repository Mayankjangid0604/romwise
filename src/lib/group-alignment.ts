import { z } from "zod";
import { AIGateway } from "./ai/gateway";
import { AIGatewayError } from "./ai/types";
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const travelerProfileSchema = z.object({
  name: z.string().trim().min(1),
  pace: z.enum(["easy", "balanced", "full"]),
  interests: z.array(z.string().trim()),
  priorities: z.array(z.string().trim()),
  foodPreferences: z.array(z.string().trim()),
  accessibility: z.array(z.string().trim())
});

export const groupAlignmentInputSchema = z.object({
  travelers: z.array(travelerProfileSchema).min(2).max(20)
});

export const groupAlignmentResponseSchema = z.object({
  coreTension: z.string().trim().min(1),
  compromiseSuggestion: z.string().trim().min(1),
  harmonyScore: z.number().min(0).max(100).transform(Math.round)
});

export type TravelerProfile = z.infer<typeof travelerProfileSchema>;
export type GroupAlignmentInput = z.infer<typeof groupAlignmentInputSchema>;
export type GroupAlignmentResponse = z.infer<typeof groupAlignmentResponseSchema>;

export function validateGroupAlignmentInput(input: unknown): GroupAlignmentInput {
  const result = groupAlignmentInputSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(`Invalid group alignment input: ${result.error.message}`);
  }
  return result.data;
}

export function validateGroupAlignmentResponse(data: unknown): GroupAlignmentResponse {
  const result = groupAlignmentResponseSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Invalid AI response: ${result.error.message}`);
  }
  return result.data;
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
  const profilesSummary = input.travelers
    .map(
      (t) =>
        `- ${t.name}: pace=${t.pace}, interests=[${t.interests.join(", ")}], priorities=[${t.priorities.join(", ")}], food=[${t.foodPreferences.join(", ")}], accessibility=[${t.accessibility.join(", ")}]`,
    )
    .join("\n");

  const result = await AIGateway.generateStructured<unknown>({
    prompt: `${GROUP_ALIGNMENT_PROMPT}\n\nTraveler profiles:\n${profilesSummary}`,
    context: { task: "group_alignment" },
  });

  try {
    return validateGroupAlignmentResponse(result.data);
  } catch (error) {
    throw new AIGatewayError("Failed to validate group alignment response", "AI_INVALID_OUTPUT", false);
  }
}
