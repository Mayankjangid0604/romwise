import type { CandidatePlaceV2 } from "./types";
import { PLACE_TO_PREFERENCE_CATEGORY } from "../categories";
import type { MemberPreference } from "../preference-scoring";

export function computeDataQualityScore(place: CandidatePlaceV2): number {
  let score = 0;
  if (place.lat !== null && place.lng !== null) score += 20;
  if (place.durationMinutes !== null) score += 10;
  if (place.typicalCostInr !== null) score += 10;
  if (place.openingTime !== null && place.closingTime !== null) score += 10;
  if (place.area !== null) score += 10;
  return score;
}

export function computeBudgetScore(place: CandidatePlaceV2, dailyBudgetInr: number): number {
  if (place.typicalCostInr === null) {
    return 50; // Neutral for unknown
  }
  if (place.typicalCostInr === 0) {
    return 100; // Free is great
  }
  if (dailyBudgetInr <= 0) {
    return place.typicalCostInr > 0 ? 0 : 100;
  }
  
  const ratio = place.typicalCostInr / dailyBudgetInr;
  if (ratio > 1) {
    return Math.max(0, Math.round((1 - (ratio - 1)) * 50));
  }
  return Math.round((1 - ratio * 0.5) * 100);
}

export function scoreCandidates(
  places: CandidatePlaceV2[],
  dailyBudgetInr: number,
  accessibilityRequirement: string
): CandidatePlaceV2[] {
  return places.map(place => {
    // Interest score is pre-calculated from getCandidatePlaces as place.preferenceScore
    let interest = place.preferenceScore; 
    
    // User status overrides
    if (place.userStatus === "must-visit") {
      interest += 500; // massive boost
    } else if (place.userStatus === "interested") {
      interest += 100; // significant boost
    }
    
    const category = 10; // baseline
    const popularity = Math.min(place.popularityScore, 100);
    const dataQuality = computeDataQualityScore(place);
    
    // Accessibility is partially pre-calculated, but let's reinforce it
    let accessibility = 0;
    if (accessibilityRequirement !== "none" && place.accessibilityScore !== null) {
       accessibility = place.accessibilityScore * 10; 
    }

    const budget = computeBudgetScore(place, dailyBudgetInr);
    
    // Penalties
    let penalties = 0;
    if (place.fatigueCost !== null && place.fatigueCost >= 4) {
      penalties += 10;
    }

    const total = Math.round(
      (interest * 1.5) + 
      popularity + 
      dataQuality + 
      accessibility + 
      (budget * 0.5) - 
      penalties
    );

    return {
      ...place,
      v2Score: {
        interest,
        category,
        popularity,
        dataQuality,
        accessibility,
        geographic: 0,
        diversity: 0,
        pace: 0,
        budget,
        localArea: 0,
        penalties,
        total
      }
    };
  }).sort((a, b) => (b.v2Score?.total ?? 0) - (a.v2Score?.total ?? 0));
}
