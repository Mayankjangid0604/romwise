import type { PaceLevel } from "../trip-brain";

export type CandidatePlaceV2 = {
  id: string;
  name: string;
  slug: string;
  category: string;
  lat: number | null;
  lng: number | null;
  typicalCostInr: number | null;
  durationMinutes: number | null;
  openingTime: string | null;
  closingTime: string | null;
  bestSeason: string | null;
  description: string | null;
  area: string | null;
  popularityScore: number;
  hiddenGem: boolean;
  preferenceScore: number;
  accessibilityScore: number | null;
  fatigueCost: number | null;
  userStatus?: "must-visit" | "interested" | "exclude" | null;
  
  // V2 specific augmented fields
  v2Score?: {
    interest: number;
    category: number;
    popularity: number;
    dataQuality: number;
    accessibility: number;
    geographic: number;
    diversity: number;
    pace: number;
    budget: number;
    localArea: number;
    penalties: number;
    total: number;
  };
};

export type V2GeneratedItem = {
  placeId: string;
  title: string;
  description: string;
  category: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  estimatedCostInr: number | null;
  costSource: "db" | "free" | "unknown";
  lat: number | null;
  lng: number | null;
  reasoning: string;
  order: number;
};

export type V2GeneratedDay = {
  dayNumber: number;
  date: Date;
  items: V2GeneratedItem[];
};

export type V2PlannerResult = {
  days: V2GeneratedDay[];
  unscheduledMustVisits: {
    placeId: string;
    name: string;
    reason: string;
  }[];
  metrics: {
    candidateCount: number;
    selectedCount: number;
    generationDurationMs: number;
    validPlaceRate: number;
    hallucinatedPlaceCount: number;
    duplicatePlaceCount: number;
    timeOverlapCount: number;
    dayBoundaryViolations: number;
    knownClosedViolations: number;
    destinationMismatch: number;
    geographicCoherence: number; // roughly travel distance in km
    budgetFit: number;
    knownCost: number;
    unknownCostItemCount: number;
  };
};
