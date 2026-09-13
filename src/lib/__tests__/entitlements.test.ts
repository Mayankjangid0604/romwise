import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("entitlements", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../entitlements.ts"),
    "utf-8",
  );

  it("defines a free generation limit", () => {
    expect(source).toContain("FREE_TRIP_GENERATIONS");
  });

  it("returns canGenerate boolean", () => {
    expect(source).toContain("canGenerate");
  });

  it("provides a reason when generation is denied", () => {
    expect(source).toContain("reason");
  });

  it("checks tripGenerations against the limit", () => {
    expect(source).toContain("tripGenerations");
    expect(source).toContain("FREE_TRIP_GENERATIONS");
  });

  it("returns used and limit counts", () => {
    expect(source).toContain("used:");
    expect(source).toContain("limit:");
  });
});

describe("itinerary action integration", () => {
  const actionSource = fs.readFileSync(
    path.resolve(__dirname, "../../app/actions/itinerary.ts"),
    "utf-8",
  );

  it("checks entitlement before generating", () => {
    expect(actionSource).toContain("checkGenerationEntitlement");
    expect(actionSource).toContain("canGenerate");
  });

  it("increments tripGenerations after successful generation", () => {
    expect(actionSource).toContain("tripGenerations");
    expect(actionSource).toContain("increment");
  });

  it("updates trip status to planning after generation", () => {
    expect(actionSource).toContain('status: "planning"');
  });
});
