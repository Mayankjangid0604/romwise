import { describe, it, expect } from "vitest";
import { isValidCategory, isValidPriority, CATEGORIES, PRIORITIES } from "../preferences";

describe("isValidCategory", () => {
  it("accepts all valid categories", () => {
    for (const cat of CATEGORIES) {
      expect(isValidCategory(cat)).toBe(true);
    }
  });

  it("rejects invalid categories", () => {
    expect(isValidCategory("invalid")).toBe(false);
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory("DINING")).toBe(false);
  });
});

describe("isValidPriority", () => {
  it("accepts all valid priorities", () => {
    for (const priority of PRIORITIES) {
      expect(isValidPriority(priority)).toBe(true);
    }
  });

  it("rejects invalid priorities", () => {
    expect(isValidPriority("invalid")).toBe(false);
    expect(isValidPriority("")).toBe(false);
    expect(isValidPriority("MUST-HAVE")).toBe(false);
  });
});

describe("categories and priorities", () => {
  it("has 17 activity categories", () => {
    expect(CATEGORIES).toHaveLength(17);
  });

  it("has 6 priority levels", () => {
    expect(PRIORITIES).toHaveLength(6);
  });

  it("includes key categories", () => {
    expect(CATEGORIES).toContain("dining");
    expect(CATEGORIES).toContain("adventure");
    expect(CATEGORIES).toContain("nature");
    expect(CATEGORIES).toContain("culture");
  });

  it("includes key priorities", () => {
    expect(PRIORITIES).toContain("must-have");
    expect(PRIORITIES).toContain("avoid");
    expect(PRIORITIES).toContain("never");
  });
});
