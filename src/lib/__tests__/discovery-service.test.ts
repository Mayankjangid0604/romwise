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

import { discoverDestinations, type DiscoveryInput, ValidationError } from "../discovery";
import { AIGateway } from "../ai/gateway";
import { AIGatewayError } from "../ai/types";

const mockGenerateStructured = vi.mocked(AIGateway.generateStructured);

const VALID_AI_RESPONSE = JSON.stringify({
  destinations: [
    {
      name: "Goa, India",
      rationale: "Perfect for beach and food",
      climate: "Tropical",
      bestTravelTime: "November-February",
      suggestedBudgetLevel: "Mid-range",
      activities: ["Beach", "Food tour", "Temples"],
      matchScore: 90,
    },
    {
      name: "Bali, Indonesia",
      rationale: "Great culture and nature",
      climate: "Tropical",
      bestTravelTime: "April-October",
      suggestedBudgetLevel: "Mid-range",
      activities: ["Rice terraces", "Temples", "Surfing"],
      matchScore: 85,
    },
    {
      name: "Phuket, Thailand",
      rationale: "Affordable beach paradise",
      climate: "Tropical",
      bestTravelTime: "November-March",
      suggestedBudgetLevel: "Budget",
      activities: ["Islands", "Night market", "Diving"],
      matchScore: 80,
    },
  ],
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

const INPUT: DiscoveryInput = {
  description: "A relaxing beach trip for two adults",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("discoverDestinations", () => {
  it("returns parsed destinations on valid response", async () => {
    setupMockClient(VALID_AI_RESPONSE);
    const result = await discoverDestinations(INPUT);

    expect(result.destinations).toHaveLength(3);
    expect(result.destinations[0].name).toBe("Goa, India");
    expect(result.destinations[0].matchScore).toBe(90);
  });

  it("handles response wrapped in markdown code fence", async () => {
    setupMockClient("```json\n" + VALID_AI_RESPONSE + "\n```");
    const result = await discoverDestinations(INPUT);
    expect(result.destinations).toHaveLength(3);
  });

  it("throws AIGatewayError on API failure", async () => {
    mockGenerateStructured.mockRejectedValue(new AIGatewayError("Network error", "AI_PROVIDER_ERROR", true));

    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError on empty response", async () => {
    mockGenerateStructured.mockRejectedValue(new AIGatewayError("Empty response", "AI_PROVIDER_ERROR"));
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError on invalid JSON", async () => {
    setupMockClient("not json at all", false);
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError on wrong number of destinations", async () => {
    const bad = JSON.stringify({
      destinations: [
        {
          name: "Only one",
          rationale: "Test",
          climate: "Tropical",
          bestTravelTime: "Nov",
          suggestedBudgetLevel: "Budget",
          activities: ["Beach"],
          matchScore: 50,
        },
      ],
    });
    setupMockClient(bad);
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });

  it("throws AIGatewayError when matchScore is out of range", async () => {
    const parsed = JSON.parse(VALID_AI_RESPONSE);
    parsed.destinations[0].matchScore = 200;
    setupMockClient(JSON.stringify(parsed));
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      AIGatewayError,
    );
  });
});
