import { RoutingProvider } from "./types";
import { ApproximateRoutingProvider } from "./approximate";
import { GoogleRoutesProvider } from "./google-stub";

export * from "./types";

export function getRoutingProvider(): RoutingProvider {
  const providerName = process.env.ROUTING_PROVIDER || "approximate";
  
  if (providerName === "google") {
    const google = new GoogleRoutesProvider();
    if (google.isAvailable()) {
      return google;
    }
  }

  // Fallback / default
  return new ApproximateRoutingProvider();
}
