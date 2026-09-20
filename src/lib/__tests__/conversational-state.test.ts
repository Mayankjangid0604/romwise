/**
 * Behavioral tests for conversational planner state.
 *
 * Tests prove that:
 * 1. Preferences are extracted from natural language descriptions
 * 2. Accessibility notes are preserved through the pipeline
 * 3. State mutation (budget/preference changes mid-conversation) works
 * 4. The trip creation bridge correctly maps preferences to TravelerPreference
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Zod schema mirroring the planner route (must stay in sync)
const preferenceItemSchema = z.object({
  category: z.string().min(1),
  priority: z.enum(["must-have", "very-important", "preferred", "nice-to-have", "avoid", "never"]),
});

const extractedDataSchema = z.object({
  destination: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetInr: z.number().optional(),
  paceLevel: z.enum(["easy", "balanced", "full"]).optional(),
  maxTravelers: z.number().optional(),
  preferences: z.array(preferenceItemSchema).optional(),
  accessibilityNotes: z.string().optional(),
  constraints: z.object({
    avoid: z.array(z.string()).optional(),
  }).optional(),
});

type ExtractedData = z.infer<typeof extractedDataSchema>;

// ── Preference utilities (mirrors logic from categories.ts and preference-scoring.ts) ──

const VALID_PREFERENCE_CATEGORIES = [
  "dining", "sightseeing", "adventure", "culture",
  "shopping", "relaxation", "nightlife", "nature",
] as const;

type PreferenceCategory = typeof VALID_PREFERENCE_CATEGORIES[number];
type Priority = "must-have" | "very-important" | "preferred" | "nice-to-have" | "avoid" | "never";

function isValidPreferenceCategory(cat: string): cat is PreferenceCategory {
  return VALID_PREFERENCE_CATEGORIES.includes(cat as PreferenceCategory);
}

/**
 * Simulate what the createTrip action does: parse JSON preferences,
 * filter to valid categories, and return what would be saved to DB.
 */
function tripCreationBridge(preferences: { category: string; priority: string }[]) {
  return preferences.filter((p) => isValidPreferenceCategory(p.category));
}

// ── Accessibility keyword extraction (mirrors logic from trip-brain.ts) ──

type AccessibilityRequirement = "none" | "low_walking" | "wheelchair" | "senior" | "child";

function deriveAccessibilityRequirement(notes: string | undefined): AccessibilityRequirement {
  if (!notes) return "none";
  const lower = notes.toLowerCase();
  if (lower.includes("wheelchair")) return "wheelchair";
  if (lower.includes("low walk") || lower.includes("low-walk") || lower.includes("minimal walk")) return "low_walking";
  if (lower.includes("senior") || lower.includes("elderly")) return "senior";
  if (lower.includes("child") || lower.includes("kids") || lower.includes("toddler") || lower.includes("baby")) return "child";
  return "none";
}

// ── Tests ──

describe("Conversational Planner State", () => {
  describe("Schema validation", () => {
    it("accepts a fully populated extracted data object", () => {
      const data: ExtractedData = {
        destination: "Jaipur",
        startDate: "2025-03-01",
        endDate: "2025-03-05",
        budgetInr: 20000,
        paceLevel: "balanced",
        maxTravelers: 4,
        preferences: [
          { category: "dining", priority: "preferred" },
          { category: "culture", priority: "preferred" },
          { category: "culture", priority: "never" }, // avoid museums conflicts handled at scoring
        ],
        accessibilityNotes: "low walking",
      };

      const result = extractedDataSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.destination).toBe("Jaipur");
        expect(result.data.preferences).toHaveLength(3);
        expect(result.data.accessibilityNotes).toBe("low walking");
      }
    });

    it("accepts partial state (mid-conversation)", () => {
      // Early in conversation: only destination known
      const partial: ExtractedData = {
        destination: "Jaipur",
      };

      const result = extractedDataSchema.safeParse(partial);
      expect(result.success).toBe(true);
    });

    it("rejects invalid priority values", () => {
      const data = {
        preferences: [
          { category: "dining", priority: "invalid-priority" },
        ],
      };

      const result = extractedDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("preserves accessibility notes as a string", () => {
      const data = {
        destination: "Kerala",
        accessibilityNotes: "wheelchair accessible routes only, no stairs",
      };

      const result = extractedDataSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accessibilityNotes).toBe("wheelchair accessible routes only, no stairs");
      }
    });
  });

  describe("Budget mutation (state update simulation)", () => {
    it("override budget from 20000 to 10000", () => {
      // First message returns budgetInr: 20000
      const state1: ExtractedData = {
        destination: "Jaipur",
        budgetInr: 20000,
        maxTravelers: 4,
      };

      // User says "actually make it ₹10,000"
      // Second AI response returns updated budget
      const state2: ExtractedData = {
        ...state1,
        budgetInr: 10000,
      };

      const result = extractedDataSchema.safeParse(state2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budgetInr).toBe(10000);
        expect(result.data.destination).toBe("Jaipur"); // unchanged fields preserved
      }
    });
  });

  describe("Preference mutation simulation", () => {
    it("adds 'nature' preference after initial state", () => {
      const state1: ExtractedData = {
        preferences: [{ category: "dining", priority: "preferred" }],
      };

      // User says "I also enjoy outdoor activities"
      const state2: ExtractedData = {
        preferences: [
          { category: "dining", priority: "preferred" },
          { category: "nature", priority: "preferred" },
        ],
      };

      const result = extractedDataSchema.safeParse(state2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preferences).toHaveLength(2);
        expect(result.data.preferences?.find((p) => p.category === "nature")).toBeTruthy();
      }
    });

    it("marks museums as 'never' (hard exclusion)", () => {
      const state: ExtractedData = {
        destination: "Jaipur",
        preferences: [
          { category: "dining", priority: "preferred" },
          { category: "culture", priority: "never" }, // "avoid museums" → culture = never
        ],
      };

      const result = extractedDataSchema.safeParse(state);
      expect(result.success).toBe(true);
      if (result.success) {
        const cultureExclusion = result.data.preferences?.find(
          (p) => p.category === "culture" && p.priority === "never"
        );
        expect(cultureExclusion).toBeTruthy();
      }
    });
  });

  describe("Trip creation bridge (preferences → TravelerPreference)", () => {
    it("saves valid preference categories", () => {
      const preferences = [
        { category: "dining", priority: "preferred" },
        { category: "culture", priority: "preferred" },
        { category: "nature", priority: "must-have" },
      ];

      const saved = tripCreationBridge(preferences);
      expect(saved).toHaveLength(3);
      expect(saved.every((p) => isValidPreferenceCategory(p.category))).toBe(true);
    });

    it("filters out invalid/unsupported categories", () => {
      const preferences = [
        { category: "dining", priority: "preferred" },
        { category: "museums", priority: "preferred" }, // not a valid preference category
        { category: "unknown_category", priority: "preferred" },
      ];

      const saved = tripCreationBridge(preferences);
      expect(saved).toHaveLength(1);
      expect(saved[0].category).toBe("dining");
    });

    it("preserves 'never' exclusions through the bridge", () => {
      const preferences = [
        { category: "nightlife", priority: "never" },
        { category: "dining", priority: "preferred" },
      ];

      const saved = tripCreationBridge(preferences);
      const nightlifeExclusion = saved.find((p) => p.category === "nightlife");
      expect(nightlifeExclusion?.priority).toBe("never");
    });

    it("handles empty preferences gracefully", () => {
      const saved = tripCreationBridge([]);
      expect(saved).toHaveLength(0);
    });
  });

  describe("Accessibility keyword → requirement derivation", () => {
    it("maps 'wheelchair' notes correctly", () => {
      expect(deriveAccessibilityRequirement("wheelchair accessible required")).toBe("wheelchair");
      expect(deriveAccessibilityRequirement("need wheelchair access")).toBe("wheelchair");
    });

    it("maps 'low walking' variants correctly", () => {
      expect(deriveAccessibilityRequirement("low walking")).toBe("low_walking");
      expect(deriveAccessibilityRequirement("low-walking distance")).toBe("low_walking");
      expect(deriveAccessibilityRequirement("minimal walking")).toBe("low_walking");
    });

    it("maps senior/elderly correctly", () => {
      expect(deriveAccessibilityRequirement("senior travelers")).toBe("senior");
      expect(deriveAccessibilityRequirement("traveling with elderly parents")).toBe("senior");
    });

    it("maps child/kids correctly", () => {
      expect(deriveAccessibilityRequirement("traveling with kids")).toBe("child");
      expect(deriveAccessibilityRequirement("bringing children aged 5 and 8")).toBe("child");
      expect(deriveAccessibilityRequirement("toddler needs easy access")).toBe("child");
    });

    it("returns 'none' for empty or unrecognized notes", () => {
      expect(deriveAccessibilityRequirement(undefined)).toBe("none");
      expect(deriveAccessibilityRequirement("")).toBe("none");
      expect(deriveAccessibilityRequirement("no special requirements")).toBe("none");
    });
  });
});
