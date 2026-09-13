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

import {
  analyzeGroupAlignment,
  type GroupAlignmentInput,
} from "../group-alignment";
import { getGeminiClient, GeminiProviderError, GeminiSchemaError } from "../gemini";

const mockGetClient = vi.mocked(getGeminiClient);

const VALID_AI_RESPONSE = JSON.stringify({
  coreTension:
    "Alice prefers a relaxed pace while Bob wants an action-packed schedule",
  compromiseSuggestion:
    "Alternate between active days and rest days, giving each person one day to lead the agenda",
  harmonyScore: 65,
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

  it("throws GeminiProviderError on API failure", async () => {
    mockGetClient.mockReturnValue({
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("Timeout")),
      },
    } as never);

    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiProviderError,
    );
  });

  it("throws GeminiProviderError on empty response", async () => {
    setupMockClient("   ");
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiProviderError,
    );
  });

  it("throws GeminiSchemaError on invalid JSON", async () => {
    setupMockClient("This is not JSON");
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });

  it("throws GeminiSchemaError when harmonyScore is missing", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "Some tension",
        compromiseSuggestion: "Some suggestion",
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });

  it("throws GeminiSchemaError when harmonyScore exceeds 100", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "Tension",
        compromiseSuggestion: "Suggestion",
        harmonyScore: 200,
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });

  it("throws GeminiSchemaError when coreTension is empty", async () => {
    setupMockClient(
      JSON.stringify({
        coreTension: "",
        compromiseSuggestion: "Suggestion",
        harmonyScore: 50,
      }),
    );
    await expect(analyzeGroupAlignment(INPUT)).rejects.toThrow(
      GeminiSchemaError,
    );
  });
});
