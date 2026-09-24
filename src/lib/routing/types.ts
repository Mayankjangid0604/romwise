export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutingRequest {
  origin: Coordinates;
  destination: Coordinates;
  waypoints?: Coordinates[];
  mode?: "driving" | "walking" | "transit" | "bicycling";
}

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
  geometry?: string; // e.g., polyline
}

export interface RoutingResponse {
  distanceKm: number;
  durationMinutes: number;
  legs: RouteLeg[];
  geometry?: string;
  provider: string;
}

export interface RoutingProvider {
  name: string;
  isAvailable(): boolean;
  getRoute(request: RoutingRequest): Promise<RoutingResponse>;
}
