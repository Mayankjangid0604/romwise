import { haversineKm } from "./route-optimizer";

export type SampleHotel = {
  name: string;
  costPerNightInr: number;
  lat: number;
  lng: number;
  rating: number;
  amenities: string[];
};

export type RankedHotel = SampleHotel & {
  totalCostInr: number;
  avgDistanceToStopsKm: number;
  budgetFitScore: number;
  distanceScore: number;
  overallScore: number;
};

export type StayRankingInput = {
  nights: number;
  remainingBudgetInr: number;
  stopCoordinates: { lat: number; lng: number }[];
};

export const SAMPLE_HOTELS: SampleHotel[] = [
  { name: "Budget Inn Express", costPerNightInr: 1200, lat: 15.4950, lng: 73.8300, rating: 3.2, amenities: ["WiFi", "AC"] },
  { name: "Coastal View Hostel", costPerNightInr: 800, lat: 15.4880, lng: 73.8250, rating: 3.5, amenities: ["WiFi", "Breakfast"] },
  { name: "Traveler's Rest Lodge", costPerNightInr: 1800, lat: 15.4920, lng: 73.8320, rating: 3.8, amenities: ["WiFi", "AC", "Pool"] },
  { name: "Heritage Comfort Hotel", costPerNightInr: 3500, lat: 15.4900, lng: 73.8280, rating: 4.2, amenities: ["WiFi", "AC", "Pool", "Spa", "Restaurant"] },
  { name: "Grand Palace Resort", costPerNightInr: 6000, lat: 15.4870, lng: 73.8350, rating: 4.6, amenities: ["WiFi", "AC", "Pool", "Spa", "Restaurant", "Gym", "Beach access"] },
  { name: "Backpacker's Bunk", costPerNightInr: 500, lat: 15.4960, lng: 73.8220, rating: 3.0, amenities: ["WiFi"] },
  { name: "Sunrise Boutique Stay", costPerNightInr: 2800, lat: 15.4940, lng: 73.8310, rating: 4.0, amenities: ["WiFi", "AC", "Breakfast", "Garden"] },
  { name: "City Central Rooms", costPerNightInr: 1500, lat: 15.4910, lng: 73.8270, rating: 3.6, amenities: ["WiFi", "AC", "Parking"] },
  { name: "Lakeview Premium Suites", costPerNightInr: 4500, lat: 15.4855, lng: 73.8340, rating: 4.4, amenities: ["WiFi", "AC", "Pool", "Restaurant", "Lake view"] },
  { name: "Eco Garden Retreat", costPerNightInr: 2200, lat: 15.4975, lng: 73.8260, rating: 3.9, amenities: ["WiFi", "Breakfast", "Garden", "Yoga"] },
];

function computeAvgDistance(
  hotel: SampleHotel,
  stops: { lat: number; lng: number }[],
): number {
  if (stops.length === 0) return 0;
  const totalDist = stops.reduce(
    (sum, stop) => sum + haversineKm(hotel.lat, hotel.lng, stop.lat, stop.lng),
    0,
  );
  return Math.round((totalDist / stops.length) * 100) / 100;
}

function computeBudgetFitScore(
  totalCostInr: number,
  remainingBudgetInr: number,
): number {
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

export function rankHotels(input: StayRankingInput): RankedHotel[] {
  return SAMPLE_HOTELS.map((hotel) => {
    const totalCostInr = hotel.costPerNightInr * input.nights;
    const avgDistanceToStopsKm = computeAvgDistance(
      hotel,
      input.stopCoordinates,
    );
    const budgetFitScore = computeBudgetFitScore(
      totalCostInr,
      input.remainingBudgetInr,
    );
    const distanceScore = computeDistanceScore(avgDistanceToStopsKm);
    const overallScore = Math.round(budgetFitScore * 0.5 + distanceScore * 0.5);

    return {
      ...hotel,
      totalCostInr,
      avgDistanceToStopsKm,
      budgetFitScore,
      distanceScore,
      overallScore,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}
