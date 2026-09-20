import { AITask, AIProviderName } from "./types";

// Pricing per 1M tokens
// Values in USD
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash-lite": { input: 0.30, output: 2.50 },
};

export function getModelForTask(task: AITask): { provider: AIProviderName; model: string } {
  // Use gemini-3.5-flash-lite as the default model
  const defaultModel = "gemini-3.5-flash-lite";

  if (task === "destination_discovery") {
    return {
      provider: "gemini",
      model: process.env.AI_DISCOVERY_MODEL || defaultModel,
    };
  }

  if (task === "destination_details") {
    return {
      provider: "gemini",
      model: process.env.AI_DESTINATION_DETAILS_MODEL || defaultModel,
    };
  }

  if (task === "trip_planning") {
    return {
      provider: "gemini",
      model: process.env.AI_TRIP_BRAIN_MODEL || defaultModel,
    };
  }

  if (task === "replanning") {
    return {
      provider: "gemini",
      model: process.env.AI_REPLANNER_MODEL || defaultModel,
    };
  }

  if (task === "group_alignment") {
    return {
      provider: "gemini",
      model: process.env.AI_GROUP_ALIGNMENT_MODEL || defaultModel,
    };
  }

  if (task === "packing") {
    return {
      provider: "gemini",
      model: process.env.AI_PACKING_MODEL || defaultModel,
    };
  }

  if (task === "preference_extraction") {
    return {
      provider: "gemini",
      model: process.env.AI_EXTRACTION_MODEL || defaultModel,
    };
  }

  if (task === "conversation") {
    return {
      provider: "gemini",
      model: process.env.AI_CONVERSATION_MODEL || defaultModel,
    };
  }

  // Fallback
  return {
    provider: "gemini",
    model: defaultModel,
  };
}

export function estimateCost(model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  if (inputTokens === null || outputTokens === null) return null;
  const pricing = PRICING[model];
  if (!pricing) return null;

  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
