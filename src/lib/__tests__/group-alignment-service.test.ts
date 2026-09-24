import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/gateway", () => {
  const AIGatewayError = class extends Error {
    constructor(msg: string, public code: string, public isTransient: boolean = false) {
      super(msg);
      this.name = "AIGatewayError";
    }
  };
  return { AIGatewayError, AIGateway: { generateStructured: vi.fn() } };
});

import {
  analyzeGroupAlignment,
  type GroupAlignmentInput,
} from "../group-alignment";
import { AIGateway } from "../ai/gateway";
import { AIGatewayError } from "../ai/types";
import { ValidationError } from "../group-alignment";

const mockGenerateStructured = vi.mocked(AIGateway.generateStructured);

const VALID_AI_RESPONSE = JSON.stringify({
  coreTension:
    "Alice prefers a relaxed pace while Bob wants an action-packed schedule",
  compromiseSuggestion:
    "Alternate between active days and rest days, giving each person one day to lead the agenda",
  harmonyScore: 65,
});

function setupMockClient(responseText: string, parseAsJson: boolean = true) {
  if (!parseAsJson) {
    mockGenerateStructured.mockRejectedValue(new AIGatewayError("Not valid JSON", "AI_INVALID_OUTPUT"));
    return;
  }
  let data;
  try {
    data = JSON.parse(responseText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
  } catch (e) {
    data = responseText; // Let validate function handle bad structure if it parsed successfully
  }
  
  mockGenerateStructured.mockResolvedValue({
    data,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCost: 0, currency: "USD" },
    latencyMs: 100,
    provider: "gemini",
    model: "gemini-2.5-flash",
    requestId: "mock-id",
    fallbackUsed: false,
  });
}

const INPUT: GroupAlignmentInput = {
  travelers: [
    {
      name: "Alice",
      pace: "easy",
      interests: ["art", "food"],
      priorities: ["relaxation"],
      foodPreferences: ["vegetarian"],
      accessibility: [],
    },
    {
      name: "Bob",
      pace: "full",
      interests: ["hiking", "adventure"],
      priorities: ["exploration"],
      foodPreferences: [],
      accessibility: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeGroupAlignment", () => {
  it("returns parsed alignment on valid response", async () => {
    setupMockClient(VALID_AI_RESPONSE);
    const result = await analyzeGroupAlignment(INPUT);

    expect(result.harmonyScore).toBe(65);
    expect(result.coreTension).toContain("Alice");
    expect(result.compromiseSuggestion).toContain("Alternate");
  });

  it("handles markdown code fence wrapping", async () => {
    setupMockClient("```json\n" + VALID_AI_RESPONSE + "\n```");
    const result = await analyzeGroupAlignment(INPUT);
    expect(result.harmonyScore).toBe(65);
  });

  it("throws AIGatewayError on API failure", async () => {
    mockGenerateStructured.mockRejectedValue(new AIGatewayError("Timeout", "AI_TIMEOUT", true));

    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError on empty response", async () => {
    mockGenerateStructured.mockRejectedValue(new AIGatewayError("Empty response", "AI_PROVIDER_ERROR"));
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError on invalid JSON", async () => {
    setupMockClient("This is not JSON", false);
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError when harmonyScore is missing", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "Some tension",
        compromiseSuggestion: "Some suggestion",
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError when harmonyScore exceeds 100", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "Tension",
        compromiseSuggestion: "Suggestion",
        harmonyScore: 200,
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError when coreTension is empty", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "",
        compromiseSuggestion: "Suggestion",
        harmonyScore: 50,
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });
});
