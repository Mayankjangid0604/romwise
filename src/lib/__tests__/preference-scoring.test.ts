import { describe, it, expect } from "vitest";
import {
  aggregatePreferences,
  getHardExclusions,
  scorePlaceForPreferences,
  isHardExcluded,
  detectPreferenceConflicts,
  type MemberPreference,
} from "../preference-scoring";

describe("aggregatePreferences", () => {
  it("sums scores across members for the same category", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "preferred" },   // +10
      { category: "nightlife", priority: "nice-to-have" }, // +5
    ];
    const result = aggregatePreferences(prefs);
    expect(result.get("nightlife")?.score).toBe(15);
    expect(result.get("nightlife")?.isHardExclusion).toBe(false);
  });

  it("never wins: nightlife must-have + never → hard exclusion", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "must-have" }, // +40
      { category: "nightlife", priority: "never" },     // -999
    ];
    const result = aggregatePreferences(prefs);
    const nightlife = result.get("nightlife");
    expect(nightlife?.isHardExclusion).toBe(true);
    // Aggregate is -959, well below hard exclusion threshold
    expect(nightlife!.score).toBeLessThan(-100);
  });

  it("single member never → hard exclusion for that category only", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "never" },
      { category: "sightseeing", priority: "must-have" },
    ];
    const result = aggregatePreferences(prefs);
    expect(result.get("nightlife")?.isHardExclusion).toBe(true);
    expect(result.get("sightseeing")?.isHardExclusion).toBe(false);
  });

  it("no preferences → empty map", () => {
    expect(aggregatePreferences([])).toEqual(new Map());
  });
});

describe("getHardExclusions", () => {
  it("returns categories where any member said never", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "never" },
      { category: "sightseeing", priority: "must-have" },
      { category: "dining", priority: "never" },
    ];
    const exclusions = getHardExclusions(prefs);
    expect(exclusions).toContain("nightlife");
    expect(exclusions).toContain("dining");
    expect(exclusions).not.toContain("sightseeing");
  });

  it("returns empty set when no never preferences", () => {
    const prefs: MemberPreference[] = [
      { category: "sightseeing", priority: "preferred" },
    ];
    expect(getHardExclusions(prefs).size).toBe(0);
  });
});

describe("scorePlaceForPreferences", () => {
  it("maps place category sightseeing → preference category sightseeing", () => {
    const prefs: MemberPreference[] = [
      { category: "sightseeing", priority: "must-have" }, // +40
    ];
    const aggregated = aggregatePreferences(prefs);
    const score = scorePlaceForPreferences("sightseeing", aggregated);
    expect(score).toBe(40);
  });

  it("maps place category history → preference category culture", () => {
    const prefs: MemberPreference[] = [
      { category: "culture", priority: "very-important" }, // +20
    ];
    const aggregated = aggregatePreferences(prefs);
    const score = scorePlaceForPreferences("history", aggregated);
    expect(score).toBe(20);
  });

  it("returns 0 for unmapped category", () => {
    const aggregated = aggregatePreferences([]);
    const score = scorePlaceForPreferences("unknown_category", aggregated);
    expect(score).toBe(0);
  });

  it("returns 0 when category not in preferences", () => {
    const prefs: MemberPreference[] = [
      { category: "dining", priority: "must-have" },
    ];
    const aggregated = aggregatePreferences(prefs);
    expect(scorePlaceForPreferences("sightseeing", aggregated)).toBe(0);
  });
});

describe("isHardExcluded", () => {
  it("place with nightlife category is excluded when nightlife is never", () => {
    const exclusions = new Set(["nightlife"]);
    expect(isHardExcluded("nightlife", exclusions)).toBe(true);
  });

  it("place with history category is excluded when culture is never (via mapping)", () => {
    // history maps to culture in PLACE_TO_PREFERENCE_CATEGORY
    const exclusions = new Set(["culture"]);
    expect(isHardExcluded("history", exclusions)).toBe(true);
  });

  it("place is not excluded when its mapped category is not excluded", () => {
    const exclusions = new Set(["nightlife"]);
    expect(isHardExcluded("sightseeing", exclusions)).toBe(false);
  });

  it("unmapped place category is never excluded", () => {
    const exclusions = new Set(["nightlife", "culture", "shopping"]);
    expect(isHardExcluded("totally_unknown_place_type", exclusions)).toBe(false);
  });
});

describe("detectPreferenceConflicts", () => {
  it("detects conflict when same category has must-have and never", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "must-have" },
      { category: "nightlife", priority: "never" },
    ];
    const conflicts = detectPreferenceConflicts(prefs);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].category).toBe("nightlife");
    expect(conflicts[0].resolution).toContain("never");
  });

  it("no conflict when must-have and avoid (not never)", () => {
    const prefs: MemberPreference[] = [
      { category: "sightseeing", priority: "must-have" },
      { category: "sightseeing", priority: "avoid" },
    ];
    const conflicts = detectPreferenceConflicts(prefs);
    expect(conflicts).toHaveLength(0);
  });

  it("returns empty array when no preferences", () => {
    expect(detectPreferenceConflicts([])).toHaveLength(0);
  });

  it("detects multiple conflicts across categories", () => {
    const prefs: MemberPreference[] = [
      { category: "nightlife", priority: "must-have" },
      { category: "nightlife", priority: "never" },
      { category: "dining", priority: "must-have" },
      { category: "dining", priority: "never" },
    ];
    const conflicts = detectPreferenceConflicts(prefs);
    expect(conflicts).toHaveLength(2);
    const categories = conflicts.map((c) => c.category).sort();
    expect(categories).toEqual(["dining", "nightlife"]);
  });
});
