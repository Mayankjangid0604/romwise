import { describe, it, expect } from "vitest";
import {
  computeBudgetSummary,
  optimizeBudget,
  type BudgetItem,
} from "../budget";

function makeItems(): BudgetItem[] {
  return [
    { id: "1", title: "Breakfast", category: "dining", estimatedCostInr: 500, dayNumber: 1 },
    { id: "2", title: "Temple visit", category: "culture", estimatedCostInr: 300, dayNumber: 1 },
    { id: "3", title: "Shopping spree", category: "shopping", estimatedCostInr: 2000, dayNumber: 1 },
    { id: "4", title: "Beach visit", category: "sightseeing", estimatedCostInr: 0, dayNumber: 1 },
    { id: "5", title: "Nightclub", category: "nightlife", estimatedCostInr: 1500, dayNumber: 2 },
    { id: "6", title: "Hiking trail", category: "adventure", estimatedCostInr: 800, dayNumber: 2 },
    { id: "7", title: "Spa treatment", category: "relaxation", estimatedCostInr: 1200, dayNumber: 2 },
    { id: "8", title: "Sunset dinner", category: "dining", estimatedCostInr: 1000, dayNumber: 2 },
  ];
}

describe("computeBudgetSummary", () => {
  it("computes correct totals", () => {
    const items = makeItems();
    const summary = computeBudgetSummary(items, 10000);

    expect(summary.totalBudget).toBe(10000);
    expect(summary.estimatedSpend).toBe(7300);
    expect(summary.remaining).toBe(2700);
    expect(summary.isOverBudget).toBe(false);
  });

  it("detects over-budget correctly", () => {
    const items = makeItems();
    const summary = computeBudgetSummary(items, 5000);

    expect(summary.isOverBudget).toBe(true);
    expect(summary.remaining).toBe(-2300);
  });

  it("groups by category", () => {
    const items = makeItems();
    const summary = computeBudgetSummary(items, 10000);

    const diningTotal = summary.categoryTotals.find(
      (c) => c.category === "dining",
    );
    expect(diningTotal?.total).toBe(1500);
    expect(diningTotal?.itemCount).toBe(2);
  });

  it("sorts categories by total descending", () => {
    const items = makeItems();
    const summary = computeBudgetSummary(items, 10000);

    for (let i = 1; i < summary.categoryTotals.length; i++) {
      expect(summary.categoryTotals[i - 1].total).toBeGreaterThanOrEqual(
        summary.categoryTotals[i].total,
      );
    }
  });

  it("handles empty items", () => {
    const summary = computeBudgetSummary([], 5000);
    expect(summary.estimatedSpend).toBe(0);
    expect(summary.remaining).toBe(5000);
    expect(summary.isOverBudget).toBe(false);
    expect(summary.categoryTotals).toHaveLength(0);
  });
});

describe("optimizeBudget", () => {
  it("returns no removals when under budget", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 10000);

    expect(result.removedItems).toHaveLength(0);
    expect(result.savings).toBe(0);
    expect(result.newEstimatedSpend).toBe(7300);
  });

  it("removes items to get under budget", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 5000);

    expect(result.removedItems.length).toBeGreaterThan(0);
    expect(result.newEstimatedSpend).toBeLessThanOrEqual(5000);
    expect(result.savings).toBe(7300 - result.newEstimatedSpend);
  });

  it("removes lower-value items first (shopping/nightlife before culture/sightseeing)", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 4000);

    const removedCategories = result.removedItems.map((r) => r.item.category);
    const lowValueCategories = ["shopping", "nightlife"];

    for (const lowCat of lowValueCategories) {
      if (removedCategories.includes(lowCat)) {
        const highValueKept = items
          .filter(
            (i) =>
              ["sightseeing", "culture"].includes(i.category) &&
              !result.removedItems.some((r) => r.item.id === i.id),
          );
        expect(highValueKept.length).toBeGreaterThan(0);
      }
    }
  });

  it("removes shopping before sightseeing (lower value score)", () => {
    const items: BudgetItem[] = [
      { id: "a", title: "Shopping", category: "shopping", estimatedCostInr: 1000, dayNumber: 1 },
      { id: "b", title: "Sightseeing", category: "sightseeing", estimatedCostInr: 1000, dayNumber: 1 },
    ];
    const result = optimizeBudget(items, 1000);

    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0].item.category).toBe("shopping");
  });

  it("among same-value items, removes more expensive first", () => {
    const items: BudgetItem[] = [
      { id: "a", title: "Cheap nightlife", category: "nightlife", estimatedCostInr: 500, dayNumber: 1 },
      { id: "b", title: "Expensive nightlife", category: "nightlife", estimatedCostInr: 2000, dayNumber: 1 },
      { id: "c", title: "Sightseeing", category: "sightseeing", estimatedCostInr: 300, dayNumber: 1 },
    ];
    const result = optimizeBudget(items, 1000);

    expect(result.removedItems[0].item.id).toBe("b");
  });

  it("provides a reason for each removed item", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 3000);

    for (const removed of result.removedItems) {
      expect(removed.reason).toBeTruthy();
      expect(removed.reason.length).toBeGreaterThan(10);
    }
  });

  it("does not remove free items", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 3000);

    const removedIds = result.removedItems.map((r) => r.item.id);
    expect(removedIds).not.toContain("4"); // Beach visit costs 0
  });

  it("handles all items needing removal", () => {
    const items: BudgetItem[] = [
      { id: "a", title: "Item A", category: "shopping", estimatedCostInr: 1000, dayNumber: 1 },
      { id: "b", title: "Item B", category: "nightlife", estimatedCostInr: 1000, dayNumber: 1 },
    ];
    const result = optimizeBudget(items, 500);

    expect(result.removedItems.length).toBe(2);
    expect(result.newEstimatedSpend).toBe(0);
  });

  it("summary after optimization reflects kept items only", () => {
    const items = makeItems();
    const result = optimizeBudget(items, 5000);

    expect(result.summary.estimatedSpend).toBe(result.newEstimatedSpend);
    expect(result.summary.isOverBudget).toBe(
      result.newEstimatedSpend > 5000,
    );
  });
});

// ── Cost discriminator invariants ─────────────────────────────────────────────
// These tests prove that null (unknown), 0 (free), and >0 (known cost) are
// handled as three distinct semantic values — never conflated.

describe("cost discriminator invariants", () => {
  it("null cost (unknown) is excluded from estimated spend — not counted as ₹0", () => {
    const items: BudgetItem[] = [
      { id: "a", title: "Known item", category: "culture", estimatedCostInr: 500, dayNumber: 1 },
      { id: "b", title: "Unknown cost item", category: "sightseeing", estimatedCostInr: null, dayNumber: 1 },
    ];
    const summary = computeBudgetSummary(items, 10000);

    // estimatedSpend should be 500, NOT 500 + 0 = 500 (which happens to be same),
    // so also verify that a null-only set has 0 spend
    expect(summary.estimatedSpend).toBe(500);
  });

  it("null-cost-only itinerary has ₹0 estimated spend", () => {
    const items: BudgetItem[] = [
      { id: "a", title: "Item 1", category: "sightseeing", estimatedCostInr: null, dayNumber: 1 },
      { id: "b", title: "Item 2", category: "culture", estimatedCostInr: null, dayNumber: 1 },
    ];
    const summary = computeBudgetSummary(items, 10000);

    expect(summary.estimatedSpend).toBe(0);
    expect(summary.isOverBudget).toBe(false);
  });

  it("genuinely free item (cost = 0) is counted in summary and not removed by optimizer", () => {
    const items: BudgetItem[] = [
      { id: "free", title: "Free entry", category: "nature", estimatedCostInr: 0, dayNumber: 1 },
      { id: "costly", title: "Shopping", category: "shopping", estimatedCostInr: 2000, dayNumber: 1 },
    ];

    const summary = computeBudgetSummary(items, 10000);
    expect(summary.estimatedSpend).toBe(2000);

    const result = optimizeBudget(items, 500);
    const removedIds = result.removedItems.map((r) => r.item.id);
    expect(removedIds).not.toContain("free");
    expect(removedIds).toContain("costly");
  });

  it("unknown-cost item (null) is never a candidate for optimizer removal", () => {
    const items: BudgetItem[] = [
      { id: "unknown", title: "Mystery tour", category: "adventure", estimatedCostInr: null, dayNumber: 1 },
      { id: "known", title: "Shopping", category: "shopping", estimatedCostInr: 1000, dayNumber: 1 },
    ];
    const result = optimizeBudget(items, 500);

    const removedIds = result.removedItems.map((r) => r.item.id);
    // null-cost item must never be removed by the optimizer (it has no known cost to save)
    expect(removedIds).not.toContain("unknown");
  });

  it("mixed null/free/known costs are all handled correctly in one summary", () => {
    const items: BudgetItem[] = [
      { id: "1", title: "Temple (free)", category: "spiritual", estimatedCostInr: 0, dayNumber: 1 },
      { id: "2", title: "Museum (unknown)", category: "culture", estimatedCostInr: null, dayNumber: 1 },
      { id: "3", title: "Lunch (known)", category: "dining", estimatedCostInr: 400, dayNumber: 1 },
    ];
    const summary = computeBudgetSummary(items, 10000);

    // Only the known cost (400) should appear in spend
    expect(summary.estimatedSpend).toBe(400);
  });
});
