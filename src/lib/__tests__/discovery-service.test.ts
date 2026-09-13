import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini", () => {
  const GeminiConfigError = class extends Error {
    constructor(msg: string) { super(msg); this.name = "GeminiConfigError"; }
  };
  const GeminiProviderError = class extends Error {
    constructor(msg: string) { super(msg); this.name = "GeminiProviderError"; }
  };
  const GeminiSchemaError = class extends Error {
    constructor(msg: string) { super(msg); this.name = "GeminiSchemaError"; }
  };

  return {
    GeminiConfigError,
    GeminiProviderError,
    GeminiSchemaError,
    getGeminiClient: vi.fn(),
  };
});

import { discoverDestinations, type DiscoveryInput } from "../discovery";
import { getGeminiClient, GeminiProviderError, GeminiSchemaError } from "../gemini";

const mockGetClient = vi.mocked(getGeminiClient);

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

function setupMockClient(responseText: string) {
  mockGetClient.mockReturnValue({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: responseText,
      }),
    },
  } as never);
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

  it("throws GeminiProviderError on API failure", async () => {
    mockGetClient.mockReturnValue({
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    } as never);

    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      GeminiProviderError,
    );
  });

  it("throws GeminiProviderError on empty response", async () => {
    setupMockClient("");
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      GeminiProviderError,
    );
  });

  it("throws GeminiSchemaError on invalid JSON", async () => {
    setupMockClient("not json at all");
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });

  it("throws GeminiSchemaError on wrong number of destinations", async () => {
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
      GeminiSchemaError,
    );
  });

  it("throws GeminiSchemaError when matchScore is out of range", async () => {
    const parsed = JSON.parse(VALID_AI_RESPONSE);
    parsed.destinations[0].matchScore = 200;
    setupMockClient(JSON.stringify(parsed));
    await expect(discoverDestinations(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });
});
