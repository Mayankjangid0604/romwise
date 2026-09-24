import { RoutingProvider, RoutingRequest, RoutingResponse } from "./types";

/**
 * Future Google Routes Provider Stub
 * 
 * This is an architecture placeholder indicating where a live road-routing 
 * provider would be integrated.
 * 
 * DO NOT add a GOOGLE_MAPS_API_KEY requirement for the current phase.
 * This provider remains inactive until a key is explicitly provided and 
 * the provider is selected in configuration.
 */
export class GoogleRoutesProvider implements RoutingProvider {
  name = "google_routes";

  isAvailable(): boolean {
    return !!process.env.GOOGLE_MAPS_API_KEY && process.env.ROUTING_PROVIDER === "google";
  }

  async getRoute(_request: RoutingRequest): Promise<RoutingResponse> {
    if (!this.isAvailable()) {
      throw new Error("Google Routes provider is not configured or activated.");
    }

    // Future implementation: fetch from https://routes.googleapis.com/directions/v2:computeRoutes
    throw new Error("Not implemented: Google Routes network calls are disabled in this phase.");
  }
}
