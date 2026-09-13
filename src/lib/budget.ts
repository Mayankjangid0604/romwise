export type BudgetItem = {
  id: string;
  title: string;
  category: string;
  estimatedCostInr: number;
  dayNumber: number;
};

export type CategoryTotal = {
  category: string;
  total: number;
  itemCount: number;
};

export type BudgetSummary = {
  totalBudget: number;
  estimatedSpend: number;
  remaining: number;
  isOverBudget: boolean;
  categoryTotals: CategoryTotal[];
};

export type RemovedItem = {
  item: BudgetItem;
  reason: string;
};

export type OptimizationResult = {
  removedItems: RemovedItem[];
  newEstimatedSpend: number;
  savings: number;
  summary: BudgetSummary;
};

const CATEGORY_VALUE_SCORES: Record<string, number> = {
  dining: 7,
  sightseeing: 8,
  culture: 7,
  nature: 6,
  adventure: 5,
  relaxation: 4,
  shopping: 3,
  nightlife: 3,
};

export function computeBudgetSummary(
  items: BudgetItem[],
  totalBudget: number,
): BudgetSummary {
  const estimatedSpend = items.reduce(
    (sum, item) => sum + item.estimatedCostInr,
    0,
  );

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const entry = categoryMap.get(item.category) || { total: 0, count: 0 };
    entry.total += item.estimatedCostInr;
    entry.count += 1;
    categoryMap.set(item.category, entry);
  }

  const categoryTotals: CategoryTotal[] = Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({
      category,
      total,
      itemCount: count,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalBudget,
    estimatedSpend,
    remaining: totalBudget - estimatedSpend,
    isOverBudget: estimatedSpend > totalBudget,
    categoryTotals,
  };
}

export function optimizeBudget(
  items: BudgetItem[],
  totalBudget: number,
): OptimizationResult {
  const currentSpend = items.reduce(
    (sum, item) => sum + item.estimatedCostInr,
    0,
  );

  if (currentSpend <= totalBudget) {
    return {
      removedItems: [],
      newEstimatedSpend: currentSpend,
      savings: 0,
      summary: computeBudgetSummary(items, totalBudget),
    };
  }

  const scored = items
    .filter((item) => item.estimatedCostInr > 0)
    .map((item) => ({
      item,
      valueScore: CATEGORY_VALUE_SCORES[item.category] ?? 5,
    }))
    .sort((a, b) => {
      if (a.valueScore !== b.valueScore) return a.valueScore - b.valueScore;
      return b.item.estimatedCostInr - a.item.estimatedCostInr;
    });

  const removedItems: RemovedItem[] = [];
  let runningSpend = currentSpend;

  for (const { item, valueScore } of scored) {
    if (runningSpend <= totalBudget) break;

    removedItems.push({
      item,
      reason: `Removed "${item.title}" (₹${item.estimatedCostInr.toLocaleString("en-IN")}) — value score ${valueScore}/10, ${item.category} category. Lowest value-to-cost ratio among remaining items.`,
    });

    runningSpend -= item.estimatedCostInr;
  }

  const keptIds = new Set(
    items
      .map((i) => i.id)
      .filter((id) => !removedItems.some((r) => r.item.id === id)),
  );
  const keptItems = items.filter((i) => keptIds.has(i.id));

  return {
    removedItems,
    newEstimatedSpend: runningSpend,
    savings: currentSpend - runningSpend,
    summary: computeBudgetSummary(keptItems, totalBudget),
  };
}
