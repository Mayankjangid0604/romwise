import { describe, it, expect } from "vitest";
import {
  validateGroupAlignmentInput,
  validateGroupAlignmentResponse,
} from "../group-alignment";
import { ValidationError } from "../discovery";


const VALID_TRAVELER = {
  name: "Alice",
  pace: "balanced" as const,
  interests: ["hiking", "photography"],
  priorities: ["relaxation"],
  foodPreferences: ["vegetarian"],
  accessibility: [],
};

describe("validateGroupAlignmentInput", () => {
  it("accepts valid input with 2 travelers", () => {
    const result = validateGroupAlignmentInput({
      travelers: [
        { ...VALID_TRAVELER, name: "Alice" },
        { ...VALID_TRAVELER, name: "Bob", pace: "full" },
      ],
    });
    expect(result.travelers).toHaveLength(2);
  });

  it("rejects fewer than 2 travelers", () => {
    expect(() =>
      validateGroupAlignmentInput({ travelers: [VALID_TRAVELER] }),
    ).toThrow(ValidationError);
  });

  it("rejects more than 20 travelers", () => {
    const travelers = Array.from({ length: 21 }, (_, i) => ({
      ...VALID_TRAVELER,
      name: `Traveler ${i}`,
    }));
    expect(() => validateGroupAlignmentInput({ travelers })).toThrow(
      ValidationError,
    );
  });

  it("rejects missing travelers array", () => {
    expect(() => validateGroupAlignmentInput({})).toThrow(ValidationError);
  });

  it("rejects empty traveler name", () => {
    expect(() =>
      validateGroupAlignmentInput({
        travelers: [
          { ...VALID_TRAVELER, name: "" },
          { ...VALID_TRAVELER, name: "Bob" },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects invalid pace", () => {
    expect(() =>
      validateGroupAlignmentInput({
        travelers: [
          { ...VALID_TRAVELER, pace: "extreme" },
          VALID_TRAVELER,
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects non-array interests", () => {
    expect(() =>
      validateGroupAlignmentInput({
        travelers: [
          { ...VALID_TRAVELER, interests: "hiking" },
          VALID_TRAVELER,
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects non-string in interests array", () => {
    expect(() =>
      validateGroupAlignmentInput({
        travelers: [
          { ...VALID_TRAVELER, interests: [123] },
          VALID_TRAVELER,
        ],
      }),
    ).toThrow(ValidationError);
  });
});

describe("validateGroupAlignmentResponse", () => {
  it("accepts valid response", () => {
    const result = validateGroupAlignmentResponse({
      coreTension: "Alice prefers relaxation while Bob wants adventure",
      compromiseSuggestion: "Alternate between active and relaxed days",
      harmonyScore: 72,
    });
    expect(result.harmonyScore).toBe(72);
    expect(result.coreTension).toContain("Alice");
  });

  it("rejects null", () => {
    expect(() => validateGroupAlignmentResponse(null)).toThrow(
      ValidationError,
    );
  });

  it("rejects empty coreTension", () => {
    expect(() =>
      validateGroupAlignmentResponse({
        coreTension: "",
        compromiseSuggestion: "Compromise",
        harmonyScore: 50,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects missing compromiseSuggestion", () => {
    expect(() =>
      validateGroupAlignmentResponse({
        coreTension: "Tension",
        harmonyScore: 50,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects harmonyScore out of range", () => {
    expect(() =>
      validateGroupAlignmentResponse({
        coreTension: "Tension",
        compromiseSuggestion: "Compromise",
        harmonyScore: 150,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects negative harmonyScore", () => {
    expect(() =>
      validateGroupAlignmentResponse({
        coreTension: "Tension",
        compromiseSuggestion: "Compromise",
        harmonyScore: -10,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects non-number harmonyScore", () => {
    expect(() =>
      validateGroupAlignmentResponse({
        coreTension: "Tension",
        compromiseSuggestion: "Compromise",
        harmonyScore: "high",
      }),
    ).toThrow(ValidationError);
  });

  it("rounds harmonyScore to integer", () => {
    const result = validateGroupAlignmentResponse({
      coreTension: "Tension",
      compromiseSuggestion: "Compromise",
      harmonyScore: 68.4,
    });
    expect(result.harmonyScore).toBe(68);
  });

  it("trims string fields", () => {
    const result = validateGroupAlignmentResponse({
      coreTension: "  Tension here  ",
      compromiseSuggestion: "  Compromise there  ",
      harmonyScore: 50,
    });
    expect(result.coreTension).toBe("Tension here");
    expect(result.compromiseSuggestion).toBe("Compromise there");
  });
});
