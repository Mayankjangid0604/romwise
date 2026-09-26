import { haversineKm } from "./route-optimizer";
import { prisma } from "./db";
import { getSampleHotelsForDestination, type SampleHotelDestination, type PropertyType } from "./sample-hotels";
import { getTripDuration } from "./date-utils";

export type StayCandidate = {
  id: string;
  name: string;
  costPerNightInr: number | null;
  lat: number;
  lng: number;
  /** Present on generated sample hotels (see sample-hotels.ts) */
  isSample?: boolean;
  propertyType?: PropertyType | null;
  rating?: number | null;
  reviewCount?: number | null;
  amenities?: string[];
  area?: string | null;
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

export type StayDestination = SampleHotelDestination & { id: string };

/**
 * Ranked stays for a destination: real `stay` places from the DB (none are imported
 * today) plus the labelled sample catalogue, scored by budget fit and distance.
 */
export async function getRankedStays(destination: StayDestination, input: StayRankingInput): Promise<RankedStay[]> {
  const places = await prisma.place.findMany({
    where: { destinationId: destination.id, category: "stay" },
    select: { id: true, name: true, typicalCostInr: true, lat: true, lng: true, area: true }
  });

  const dbStays: StayCandidate[] = places.map((place) => ({
    id: place.id,
    name: place.name,
    costPerNightInr: place.typicalCostInr ?? null,
    lat: place.lat,
    lng: place.lng,
    isSample: false,
    area: place.area,
  }));

  return rankStays([...dbStays, ...getSampleHotelsForDestination(destination)], input).slice(0, 40);
}

export type TripStayContext = {
  id: string;
  budgetInr: number;
  startDate: Date | null;
  endDate: Date | null;
  tripType: string;
  destinationRef: StayDestination | null;
};

/**
 * Stay recommendations for a trip, shared by the Stay tab and the overview so both
 * rank identically: nights from the trip dates, budget left after planned activities,
 * and distance measured to the itinerary's actual stops (falls back to the destination
 * centre before an itinerary exists).
 */
export async function getTripStayRecommendations(trip: TripStayContext): Promise<{
  nights: number;
  remainingBudgetInr: number;
  ranked: RankedStay[];
}> {
  const nights = Math.max(1, getTripDuration(trip, 3) - 1);
  const items = await prisma.itineraryItem.findMany({
    where: { itineraryDay: { tripId: trip.id } },
    select: { estimatedCostInr: true, place: { select: { lat: true, lng: true } } },
  });
  const activityCost = items.reduce((sum, i) => sum + (i.estimatedCostInr ?? 0), 0);
  const remainingBudgetInr = trip.budgetInr - activityCost;

  if (!trip.destinationRef) return { nights, remainingBudgetInr, ranked: [] };

  const stops = items
    .map((i) => i.place)
    .filter((p): p is { lat: number; lng: number } => !!p && !(p.lat === 0 && p.lng === 0));
  const center = { lat: trip.destinationRef.lat, lng: trip.destinationRef.lng };

  const ranked = await getRankedStays(trip.destinationRef, {
    nights,
    remainingBudgetInr,
    centerCoordinate: center,
    stopCoordinates: stops.length > 0 ? stops : [center],
  });
  return { nights, remainingBudgetInr, ranked };
}
