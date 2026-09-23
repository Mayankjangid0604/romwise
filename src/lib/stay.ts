import { haversineKm } from "./route-optimizer";
import { prisma } from "./db";

export type StayCandidate = {
  id: string;
  name: string;
  costPerNightInr: number | null;
  lat: number;
  lng: number;
};

export type RankedStay = StayCandidate & {
  totalCostInr: number | null;
  avgDistanceToStopsKm: number;
  budgetFitScore: number;
  distanceScore: number;
  overallScore: number;
};

export type StayRankingInput = {
  nights: number;
  remainingBudgetInr: number;
  centerCoordinate?: { lat: number; lng: number };
  stopCoordinates: { lat: number; lng: number }[];
};

function computeAvgDistance(
  lat: number,
  lng: number,
  stops: { lat: number; lng: number }[],
): number {
  if (stops.length === 0) return 0;
  const totalDist = stops.reduce(
    (sum, stop) => sum + haversineKm(lat, lng, stop.lat, stop.lng),
    0,
  );
  return Math.round((totalDist / stops.length) * 100) / 100;
}

function computeBudgetFitScore(
  totalCostInr: number | null,
  remainingBudgetInr: number,
): number {
  if (totalCostInr === null) return 50; // Neutral score for unknown costs
  if (remainingBudgetInr <= 0) return 0;
  if (totalCostInr <= 0) return 100;
  const ratio = totalCostInr / remainingBudgetInr;
  if (ratio > 1) return Math.max(0, Math.round((1 - (ratio - 1)) * 50));
  return Math.round((1 - ratio * 0.5) * 100);
}

function computeDistanceScore(avgDistKm: number): number {
  if (avgDistKm <= 0.5) return 100;
  if (avgDistKm >= 10) return 10;
  return Math.round(100 - (avgDistKm - 0.5) * (90 / 9.5));
}

export function rankStays(
  places: StayCandidate[],
  input: StayRankingInput
): RankedStay[] {
  return places.map((place) => {
    const totalCostInr = place.costPerNightInr !== null ? place.costPerNightInr * input.nights : null;
    const avgDistanceToStopsKm = computeAvgDistance(
      place.lat,
      place.lng,
      input.stopCoordinates,
    );
    const budgetFitScore = computeBudgetFitScore(
      totalCostInr,
      input.remainingBudgetInr,
    );
    const distanceScore = computeDistanceScore(avgDistanceToStopsKm);
    const overallScore = Math.round(budgetFitScore * 0.5 + distanceScore * 0.5);

    return {
      ...place,
      totalCostInr,
      avgDistanceToStopsKm,
      budgetFitScore,
      distanceScore,
      overallScore,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

export async function getRankedStays(destinationId: string, input: StayRankingInput): Promise<RankedStay[]> {
  const places = await prisma.place.findMany({
    where: { destinationId, category: "stay" },
    select: { id: true, name: true, typicalCostInr: true, lat: true, lng: true }
  });

  const candidates: StayCandidate[] = places.map((place) => ({
    id: place.id,
    name: place.name,
    costPerNightInr: place.typicalCostInr ?? null,
    lat: place.lat,
    lng: place.lng,
  }));

  return rankStays(candidates, input).slice(0, 30);
}
