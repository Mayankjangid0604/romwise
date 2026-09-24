import { RoutingProvider, RoutingRequest, RoutingResponse, RouteLeg, Coordinates } from "./types";
import { haversineKm } from "../route-optimizer";

/**
 * Approximate Routing Provider
 * Uses Haversine straight-line distances and basic speed heuristics.
 * This is the default deterministic engine.
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

    // Assuming average straight-line speed is 40 km/h for approximation
    const AVERAGE_SPEED_KMH = 40;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const dist = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
      const duration = (dist / AVERAGE_SPEED_KMH) * 60;

      legs.push({
        distanceKm: dist,
        durationMinutes: duration
      });

      totalDistanceKm += dist;
      totalDurationMinutes += duration;
    }

    return {
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMinutes,
      legs,
      provider: this.name,
    };
  }
}
