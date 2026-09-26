import type { V2PlannerResult } from "./types";
import { getCandidatePlaces } from "../travel-knowledge";
import type { CandidateQuery } from "../travel-knowledge";
import { scoreCandidates } from "./scoring";
import { buildClusters } from "./clustering";
import { buildDays } from "./scheduling";
import { validateDays } from "./validation";
import { isTransitPoint } from "../transit-filter";

export async function generateItineraryV2(
  query: CandidateQuery,
  numDays: number,
  pace: string,
  startDate: Date,
  placeSelections?: { placeId: string; status: string }[]
): Promise<V2PlannerResult> {
  const t0 = Date.now();
  
  // 1. Candidate Retrieval (Phase 5 & 6)
  const rawCandidates = await getCandidatePlaces(query);
  
  // Exclude hotels and transit hubs explicitly in case they slipped through (a railway
  // station mislabelled "history" by an importer is still not a place to visit)
  const filteredCandidates = rawCandidates.filter(c => c.category !== "stay" && !isTransitPoint(c));
  
  const v2Candidates = filteredCandidates
    .map(c => {
      const selection = placeSelections?.find(s => s.placeId === c.id);
      return {
        ...c,
        userStatus: (selection?.status as "must-visit" | "interested" | "exclude" | null) || null,
      };
    })
    .filter(c => c.userStatus !== "exclude");

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
  
  // 6. Feedback for unscheduled must-visits
  const scheduledPlaceIds = new Set(days.flatMap(d => d.items.map(i => i.placeId)));
  const unscheduledMustVisits = v2Candidates
    .filter(c => c.userStatus === "must-visit" && !scheduledPlaceIds.has(c.id))
    .map(c => ({
      placeId: c.id,
      name: c.name,
      reason: "Could not fit within available time constraints or opening hours."
    }));

  return {
    days,
    unscheduledMustVisits,
    metrics
  };
}
