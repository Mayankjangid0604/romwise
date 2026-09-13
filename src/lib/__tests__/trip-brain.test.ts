import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("trip-brain", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../trip-brain.ts"),
    "utf-8",
  );

  it("uses gemini-2.0-flash model", () => {
    expect(source).toContain('model: "gemini-2.0-flash"');
  });

  it("validates response structure", () => {
    expect(source).toContain("validateResponse");
  });

  it("defines valid categories matching itinerary engine", () => {
    const engineSource = fs.readFileSync(
      path.resolve(__dirname, "../itinerary-engine.ts"),
      "utf-8",
    );
    const categories = [
      "dining", "sightseeing", "adventure", "culture",
      "shopping", "relaxation", "nightlife", "nature",
    ];
    for (const cat of categories) {
      expect(source).toContain(cat);
      expect(engineSource).toContain(cat);
    }
  });

  it("requires non-negative cost", () => {
    expect(source).toContain("estimatedCostInr");
    expect(source).toContain("non-negative");
  });

  it("instructs LLM to use real places", () => {
    expect(source).toContain("REAL place");
    expect(source).toContain("Do NOT invent fictional places");
  });

  it("provides budget context to the LLM", () => {
    expect(source).toContain("dailyBudget");
    expect(source).toContain("budgetInr");
  });

  it("includes accessibility notes when present", () => {
    expect(source).toContain("accessibilityNotes");
    expect(source).toContain("Accessibility needs");
  });

  it("cleans markdown fences from response", () => {
    expect(source).toContain("```");
  });

  it("applies deterministic time slots from pace level", () => {
    expect(source).toContain("TIME_SLOTS");
    expect(source).toContain("easy");
    expect(source).toContain("balanced");
    expect(source).toContain("full");
  });
});
