export type BudgetItem = {
  id: string;
  title: string;
  category: string;
  // null = cost unknown; 0 = genuinely free; >0 = known cost
  estimatedCostInr: number | null;
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
  history: 7,
  nature: 6,
  adventure: 5,
  relaxation: 4,
  photography: 6,
  spiritual: 6,
  family: 7,
  local_experience: 7,
  shopping: 3,
  nightlife: 3,
};

export function computeBudgetSummary(
  items: BudgetItem[],
  totalBudget: number,
): BudgetSummary {
  // null = unknown cost — excluded from estimated spend so we don't count unknown as ₹0
  const estimatedSpend = items.reduce(
    (sum, item) => sum + (item.estimatedCostInr ?? 0),
    0,
  );

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const entry = categoryMap.get(item.category) || { total: 0, count: 0 };
    entry.total += item.estimatedCostInr ?? 0;
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
    (sum, item) => sum + (item.estimatedCostInr ?? 0),
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

  const scored = (items.filter((item) => item.estimatedCostInr !== null && item.estimatedCostInr > 0) as (BudgetItem & { estimatedCostInr: number })[])
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

    const cost = item.estimatedCostInr;
    removedItems.push({
      item,
      reason: `Removed "${item.title}" (₹${cost.toLocaleString("en-IN")}) — value score ${valueScore}/10, ${item.category} category. Lowest value-to-cost ratio among remaining items.`,
    });

    runningSpend -= cost;
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
