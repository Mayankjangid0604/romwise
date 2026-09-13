import { describe, it, expect } from "vitest";
import { computeBudgetSummary, type BudgetItem } from "../budget";

describe("budget integration with stay cost", () => {
  const activityItems: BudgetItem[] = [
    { id: "1", title: "Breakfast", category: "dining", estimatedCostInr: 500, dayNumber: 1 },
    { id: "2", title: "Temple visit", category: "culture", estimatedCostInr: 300, dayNumber: 1 },
    { id: "3", title: "Dinner", category: "dining", estimatedCostInr: 1000, dayNumber: 1 },
  ];

  it("activity-only summary shows correct totals without stay", () => {
    const summary = computeBudgetSummary(activityItems, 5000);
    expect(summary.estimatedSpend).toBe(1800);
    expect(summary.remaining).toBe(3200);
    expect(summary.isOverBudget).toBe(false);
  });

  it("adding stay cost to estimated spend changes remaining budget", () => {
    const totalBudget = 5000;
    const summary = computeBudgetSummary(activityItems, totalBudget);
    const stayCostInr = 2400;

    const totalSpendWithStay = summary.estimatedSpend + stayCostInr;
    const remainingWithStay = totalBudget - totalSpendWithStay;

    expect(totalSpendWithStay).toBe(4200);
    expect(remainingWithStay).toBe(800);
    expect(remainingWithStay).toBeLessThan(summary.remaining);
  });

  it("stay cost can push budget over limit", () => {
    const totalBudget = 3000;
    const summary = computeBudgetSummary(activityItems, totalBudget);
    const stayCostInr = 2000;

    const totalSpendWithStay = summary.estimatedSpend + stayCostInr;
    const remainingWithStay = totalBudget - totalSpendWithStay;

    expect(summary.isOverBudget).toBe(false);
    expect(remainingWithStay).toBeLessThan(0);
    expect(totalSpendWithStay).toBe(3800);
  });

  it("removing stay (zero cost) restores activity-only budget", () => {
    const totalBudget = 5000;
    const summary = computeBudgetSummary(activityItems, totalBudget);
    const stayCostInr = 0;

    const totalSpendWithStay = summary.estimatedSpend + stayCostInr;
    const remainingWithStay = totalBudget - totalSpendWithStay;

    expect(totalSpendWithStay).toBe(summary.estimatedSpend);
    expect(remainingWithStay).toBe(summary.remaining);
  });

  it("selecting a different hotel changes the total spend", () => {
    const totalBudget = 10000;
    const summary = computeBudgetSummary(activityItems, totalBudget);

    const cheapHotelCost = 500 * 3;
    const expensiveHotelCost = 4500 * 3;

    const cheapTotal = summary.estimatedSpend + cheapHotelCost;
    const expensiveTotal = summary.estimatedSpend + expensiveHotelCost;

    expect(cheapTotal).toBe(3300);
    expect(expensiveTotal).toBe(15300);
    expect(totalBudget - cheapTotal).toBeGreaterThan(0);
    expect(totalBudget - expensiveTotal).toBeLessThan(0);
  });
});
