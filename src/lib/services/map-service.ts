/**
 * Map Service
 * 
 * Provides a boundary for resolving coordinates, calculating routes,
 * and fetching geocoding data.
 * 
 * Future implementation will integrate with a Map Provider (e.g. Mapbox, Google Maps).
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteDetails {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
}

export class MapService {
  static async getCoordinates(address: string): Promise<Coordinates | null> {
    // Stub
    return null;
  }

  static async calculateRoute(origin: Coordinates, destination: Coordinates, mode: "driving" | "walking" | "transit"): Promise<RouteDetails | null> {
    // Stub
    return null;
  }
}
