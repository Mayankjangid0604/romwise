import type { V2PlannerResult } from "./types";
import { getCandidatePlaces } from "../travel-knowledge";
import type { CandidateQuery } from "../travel-knowledge";
import { scoreCandidates } from "./scoring";
import { buildClusters } from "./clustering";
import { buildDays } from "./scheduling";
import { validateDays } from "./validation";

export async function generateItineraryV2(
  query: CandidateQuery,
  numDays: number,
  pace: string,
  startDate: Date
): Promise<V2PlannerResult> {
  const t0 = Date.now();
  
  // 1. Candidate Retrieval (Phase 5 & 6)
  const rawCandidates = await getCandidatePlaces(query);
  
  // Exclude 'stay' and 'transport' explicitly just in case they slipped through
  const filteredCandidates = rawCandidates.filter(c => c.category !== "stay" && c.category !== "transport");
  
  const v2Candidates = filteredCandidates.map(c => ({
    ...c,
    // Add null fallbacks if missing (should be present in CandidatePlace type)
  }));

  // 2. Candidate Scoring (Phase 7-11)
  const scoredCandidates = scoreCandidates(v2Candidates, query.budgetPerDayInr || 0, query.accessibilityRequirement || "none");
  
  // 3. Geographic Clustering (Phase 13-14)
  const clusters = buildClusters(scoredCandidates);
  
  // 4. Scheduling Engine (Phase 17-20)
  const days = buildDays(clusters, numDays, pace, startDate);
  
  // 5. Validation (Phase 21, 27)
  const metrics = validateDays(days);
  metrics.candidateCount = filteredCandidates.length;
  metrics.generationDurationMs = Date.now() - t0;
  
  return {
    days,
    metrics
  };
}
