import { RoutingProvider, RoutingRequest, RoutingResponse, RouteLeg, Coordinates } from "./types";
import { haversineKm } from "../route-optimizer";

/**
 * Approximate Routing Provider
 * 
 * Uses Haversine straight-line distances with context-dependent speed heuristics.
 * 
 * ALL outputs are APPROXIMATE. This provider:
 * - Does NOT use real road networks
 * - Does NOT account for actual road geometry, traffic, or road conditions
 * - Does NOT provide road distance (only straight-line × penalty)
 * - Does NOT provide live traffic estimates
 * - Does NOT provide exact durations
 * 
 * Results should always be labeled as "approximate" in any UI.
 */
export class ApproximateRoutingProvider implements RoutingProvider {
  name = "approximate";

  isAvailable(): boolean {
    return true; // Always available, no network calls
  }

  async getRoute(request: RoutingRequest): Promise<RoutingResponse> {
    const points = [request.origin, ...(request.waypoints || []), request.destination];
    
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    const legs: RouteLeg[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const straightLineKm = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
      const { roadPenalty, speedKmh, label } = estimateContext(straightLineKm);
      
      // Road distance ≈ straight-line × road penalty factor
      const approxRoadKm = straightLineKm * roadPenalty;
      const durationMinutes = (approxRoadKm / speedKmh) * 60;

      legs.push({
        distanceKm: Math.round(approxRoadKm * 10) / 10,
        durationMinutes: Math.round(durationMinutes),
      });

      totalDistanceKm += approxRoadKm;
      totalDurationMinutes += durationMinutes;
    }

    return {
      distanceKm: Math.round(totalDistanceKm * 10) / 10,
      durationMinutes: Math.round(totalDurationMinutes),
      legs,
      provider: this.name,
    };
  }
}

/**
 * Context-dependent heuristics for approximate routing.
 * 
 * These are rough estimates and will be wrong for specific routes.
 * They exist to provide order-of-magnitude travel time estimates
 * without requiring a real routing API.
 */
function estimateContext(straightLineKm: number): {
  roadPenalty: number;
  speedKmh: number;
  label: string;
} {
  if (straightLineKm < 2) {
    // Very short / walkable / local
    return { roadPenalty: 1.3, speedKmh: 15, label: "local" };
  }
  if (straightLineKm < 15) {
    // Urban / within-city
    return { roadPenalty: 1.4, speedKmh: 25, label: "urban" };
  }
  if (straightLineKm < 80) {
    // Short intercity / suburban
    return { roadPenalty: 1.3, speedKmh: 45, label: "short_intercity" };
  }
  if (straightLineKm < 300) {
    // Medium intercity
    return { roadPenalty: 1.3, speedKmh: 55, label: "intercity" };
  }
  // Long distance — likely highway or train/flight candidate
  return { roadPenalty: 1.2, speedKmh: 65, label: "long_distance" };
}
