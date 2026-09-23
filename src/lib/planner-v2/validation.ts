import type { V2GeneratedDay, V2PlannerResult } from "./types";

export function validateDays(days: V2GeneratedDay[]): V2PlannerResult["metrics"] {
  let selectedCount = 0;
  let validPlaceRate = 0; // handled by engine
  let hallucinatedPlaceCount = 0;
  let duplicatePlaceCount = 0;
  let timeOverlapCount = 0;
  let dayBoundaryViolations = 0;
  let knownClosedViolations = 0;
  let destinationMismatch = 0;
  let geographicCoherence = 0;
  let budgetFit = 0;
  let knownCostCount = 0;
  let unknownCostItemCount = 0;

  const usedIds = new Set<string>();

  for (const day of days) {
    let lastEndMins = 0;
    
    for (const item of day.items) {
      selectedCount++;
      
      if (usedIds.has(item.placeId)) {
        duplicatePlaceCount++;
      }
      usedIds.add(item.placeId);
      
      if (!item.placeId || item.placeId.startsWith("temp_")) {
        hallucinatedPlaceCount++;
      }
      
      const startMins = timeStrToMins(item.startTime);
      const endMins = timeStrToMins(item.endTime);
      
      if (startMins < lastEndMins) {
        timeOverlapCount++;
      }
      lastEndMins = endMins;
      
      if (startMins < 0 || endMins > 24 * 60) {
        dayBoundaryViolations++;
      }
      
      if (item.costSource === "unknown") {
        unknownCostItemCount++;
      } else {
        knownCostCount++;
      }
      
      // Geographic coherence could be calculated if we had previous item coords
    }
  }

  return {
    candidateCount: 0, // Set by engine
    selectedCount,
    generationDurationMs: 0, // Set by engine
    validPlaceRate: selectedCount > 0 ? (selectedCount - hallucinatedPlaceCount) / selectedCount : 1,
    hallucinatedPlaceCount,
    duplicatePlaceCount,
    timeOverlapCount,
    dayBoundaryViolations,
    knownClosedViolations,
    destinationMismatch,
    geographicCoherence,
    budgetFit,
    knownCost: knownCostCount,
    unknownCostItemCount
  };
}

function timeStrToMins(ts: string): number {
  const [h, m] = ts.split(":").map(Number);
  return h * 60 + (m || 0);
}
