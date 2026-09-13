import { describe, it, expect } from "vitest";
import {
  validateDiscoveryInput,
  validateDiscoveryResponse,
  ValidationError,
} from "../discovery";
import { GeminiSchemaError } from "../gemini";

describe("validateDiscoveryInput", () => {
  it("accepts valid input", () => {
    const result = validateDiscoveryInput({
      description: "A relaxing beach trip for two",
    });
    expect(result.description).toBe("A relaxing beach trip for two");
  });

  it("trims whitespace", () => {
    const result = validateDiscoveryInput({ description: "  trip  " });
    expect(result.description).toBe("trip");
  });

  it("rejects null input", () => {
    expect(() => validateDiscoveryInput(null)).toThrow(ValidationError);
  });

  it("rejects non-object input", () => {
    expect(() => validateDiscoveryInput("string")).toThrow(ValidationError);
  });

  it("rejects empty description", () => {
    expect(() => validateDiscoveryInput({ description: "" })).toThrow(
      ValidationError,
    );
  });

  it("rejects whitespace-only description", () => {
    expect(() => validateDiscoveryInput({ description: "   " })).toThrow(
      ValidationError,
    );
  });

  it("rejects missing description", () => {
    expect(() => validateDiscoveryInput({})).toThrow(ValidationError);
  });

  it("rejects description over 1000 chars", () => {
    expect(() =>
      validateDiscoveryInput({ description: "a".repeat(1001) }),
    ).toThrow(ValidationError);
  });
});

const VALID_DESTINATION = {
  name: "Goa, India",
  rationale: "Great beaches and food",
  climate: "Tropical, warm and humid",
  bestTravelTime: "November to February",
  suggestedBudgetLevel: "Mid-range",
  activities: ["Beach visit", "Spice plantation tour", "Water sports"],
  matchScore: 85,
};

function makeValidResponse() {
  return {
    destinations: [
      { ...VALID_DESTINATION, name: "Goa, India" },
      { ...VALID_DESTINATION, name: "Bali, Indonesia" },
      { ...VALID_DESTINATION, name: "Phuket, Thailand" },
    ],
  };
}

describe("validateDiscoveryResponse", () => {
  it("accepts valid response with 3 destinations", () => {
    const result = validateDiscoveryResponse(makeValidResponse());
    expect(result.destinations).toHaveLength(3);
    expect(result.destinations[0].name).toBe("Goa, India");
    expect(result.destinations[0].matchScore).toBe(85);
  });

  it("rejects null", () => {
    expect(() => validateDiscoveryResponse(null)).toThrow(GeminiSchemaError);
  });

  it("rejects missing destinations array", () => {
    expect(() => validateDiscoveryResponse({})).toThrow(GeminiSchemaError);
  });

  it("rejects wrong number of destinations (2)", () => {
    expect(() =>
      validateDiscoveryResponse({
        destinations: [VALID_DESTINATION, VALID_DESTINATION],
      }),
    ).toThrow(GeminiSchemaError);
  });

  it("rejects wrong number of destinations (4)", () => {
    const resp = makeValidResponse();
    resp.destinations.push({ ...VALID_DESTINATION, name: "Extra" } as never);
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects empty name", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).name = "";
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects missing rationale", () => {
    const resp = makeValidResponse();
    delete (resp.destinations[1] as Record<string, unknown>).rationale;
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects empty activities array", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).activities = [];
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects more than 5 activities", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).activities = [
      "a", "b", "c", "d", "e", "f",
    ];
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects matchScore out of range (negative)", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).matchScore = -5;
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects matchScore out of range (>100)", () => {
    const resp = makeValidResponse();
    (resp.destinations[2] as Record<string, unknown>).matchScore = 150;
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rejects non-number matchScore", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).matchScore = "high";
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });

  it("rounds matchScore to integer", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).matchScore = 82.7;
    const result = validateDiscoveryResponse(resp);
    expect(result.destinations[0].matchScore).toBe(83);
  });

  it("rejects non-string activity", () => {
    const resp = makeValidResponse();
    (resp.destinations[0] as Record<string, unknown>).activities = [123];
    expect(() => validateDiscoveryResponse(resp)).toThrow(GeminiSchemaError);
  });
});
