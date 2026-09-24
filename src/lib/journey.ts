/**
 * Journey Intelligence — Intercity route planning, mode estimation, and leg construction.
 *
 * Architecture:
 *   DATABASE = FACTS (coordinates, names)
 *   DETERMINISTIC CODE = distance bands → mode heuristics
 *   NO live provider calls — all estimates are clearly labelled approximate
 *
 * This module NEVER invents:
 *   - specific flight/train numbers
 *   - exact fares
 *   - exact schedules
 */

import { haversineKm } from "./route-optimizer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteType = "ONE_WAY" | "ROUND_TRIP" | "MULTI_CITY";

export type TransportMode = "walk" | "auto" | "bus" | "train" | "flight";

export type JourneyLeg = {
  legNumber: number;
  originName: string;
  originLat: number | null;
  originLng: number | null;
  destinationName: string;
  destinationLat: number | null;
  destinationLng: number | null;
  distanceKm: number | null;
  suggestedModes: TransportMode[];
  isReturn: boolean;
  /** All estimates are approximate — never present as bookings */
  estimateLabel: "approximate" | "coordinates_missing";
};

export type JourneyPlan = {
  routeType: RouteType;
  legs: JourneyLeg[];
  totalDistanceKm: number | null;
  originName: string | null;
  destinationNames: string[];
  returnToOrigin: boolean;
};

// ─── Mode Heuristics ──────────────────────────────────────────────────────────

/**
 * Conservative distance-band mode suggestions for India geography.
 * These are heuristic only — India's terrain, road quality, and rail network
 * mean that distance alone is insufficient for precise mode selection.
 */
export function suggestTransportModes(distanceKm: number): TransportMode[] {
  if (distanceKm <= 3) return ["walk", "auto"];
  if (distanceKm <= 30) return ["auto", "bus"];
  if (distanceKm <= 150) return ["bus", "train", "auto"];
  if (distanceKm <= 600) return ["train", "bus"];
  return ["flight", "train"];
}

/**
 * Rough travel duration estimate (hours) based on mode.
 * These are deliberately conservative — never present as exact.
 */
export function estimateTravelHours(distanceKm: number, mode: TransportMode): number {
  const speeds: Record<TransportMode, number> = {
    walk: 5,
    auto: 35,    // Indian road average including traffic
    bus: 40,
    train: 55,   // Average Indian train speed including stops
    flight: 500, // Includes 2h ground time
  };
  const speed = speeds[mode];
  if (mode === "flight") {
    // Flight: minimum 2h ground time + air time
    return 2 + distanceKm / speed;
  }
  return distanceKm / speed;
}

// ─── Journey Construction ─────────────────────────────────────────────────────

export type JourneyStop = {
  name: string;
  lat: number | null;
  lng: number | null;
};

/**
 * Determine route type from trip data.
 */
export function inferRouteType(
  origin: JourneyStop | null,
  destinations: JourneyStop[],
  isRoundTrip: boolean,
): RouteType {
  if (destinations.length > 1) return "MULTI_CITY";
  if (isRoundTrip && origin) return "ROUND_TRIP";
  return "ONE_WAY";
}

/**
 * Build ordered journey legs from origin → destinations → (optional return).
 *
 * Rules:
 * - Preserves user-specified destination order (never reorders unless explicitly optimized)
 * - For ROUND_TRIP: appends final leg returning to origin
 * - Missing coordinates: leg is still created but distance/mode are marked unknown
 */
export function buildJourneyLegs(
  origin: JourneyStop | null,
  destinations: JourneyStop[],
  isRoundTrip: boolean,
): JourneyPlan {
  const legs: JourneyLeg[] = [];
  const allStops: JourneyStop[] = [];

  if (origin) allStops.push(origin);
  allStops.push(...destinations);

  // If round trip, append origin as final stop
  if (isRoundTrip && origin && allStops.length > 1) {
    allStops.push(origin);
  }

  let totalDistance = 0;
  let hasAllCoords = true;

  for (let i = 0; i < allStops.length - 1; i++) {
    const from = allStops[i];
    const to = allStops[i + 1];
    const isReturn = isRoundTrip && i === allStops.length - 2;

    let distanceKm: number | null = null;
    let suggestedModes: TransportMode[] = [];
    let estimateLabel: JourneyLeg["estimateLabel"] = "approximate";

    if (from.lat != null && from.lng != null && to.lat != null && to.lng != null) {
      distanceKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
      suggestedModes = suggestTransportModes(distanceKm);
      totalDistance += distanceKm;
    } else {
      hasAllCoords = false;
      estimateLabel = "coordinates_missing";
    }

    legs.push({
      legNumber: i + 1,
      originName: from.name,
      originLat: from.lat,
      originLng: from.lng,
      destinationName: to.name,
      destinationLat: to.lat,
      destinationLng: to.lng,
      distanceKm,
      suggestedModes,
      isReturn,
      estimateLabel,
    });
  }

  const routeType = inferRouteType(origin, destinations, isRoundTrip);

  return {
    routeType,
    legs,
    totalDistanceKm: hasAllCoords ? Math.round(totalDistance * 100) / 100 : null,
    originName: origin?.name ?? null,
    destinationNames: destinations.map((d) => d.name),
    returnToOrigin: isRoundTrip && !!origin,
  };
}

// ─── Route Optimization (for flexible multi-city) ─────────────────────────────

/**
 * Nearest-neighbor + 2-opt improvement for small destination counts.
 * Only called when user explicitly requests optimization.
 * NEVER reorders fixed-order destinations.
 */
export function optimizeDestinationOrder(
  origin: JourneyStop,
  destinations: JourneyStop[],
): JourneyStop[] {
  if (destinations.length <= 2) return [...destinations];

  // Only optimize if all have coordinates
  if (destinations.some((d) => d.lat == null || d.lng == null)) {
    return [...destinations]; // Can't optimize without coordinates
  }

  // Nearest-neighbor initial solution
  const result: JourneyStop[] = [];
  const remaining = new Set(destinations);
  let current: JourneyStop = origin;

  while (remaining.size > 0) {
    let nearest: JourneyStop | null = null;
    let nearestDist = Infinity;

    for (const stop of remaining) {
      if (current.lat == null || current.lng == null || stop.lat == null || stop.lng == null) continue;
      const dist = haversineKm(current.lat, current.lng, stop.lat, stop.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = stop;
      }
    }

    if (nearest) {
      remaining.delete(nearest);
      result.push(nearest);
      current = nearest;
    } else {
      // Shouldn't happen, but exhaust remaining
      for (const stop of remaining) result.push(stop);
      break;
    }
  }

  // 2-opt improvement
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < result.length - 1; i++) {
      for (let j = i + 2; j < result.length; j++) {
        const a = i === 0 ? origin : result[i - 1];
        const b = result[i];
        const c = result[j];
        const d = j + 1 < result.length ? result[j + 1] : origin; // return to origin for round trips

        if (a.lat == null || b.lat == null || c.lat == null || d.lat == null) continue;
        if (a.lng == null || b.lng == null || c.lng == null || d.lng == null) continue;

        const currentDist =
          haversineKm(a.lat, a.lng, b.lat, b.lng) +
          haversineKm(c.lat, c.lng, d.lat, d.lng);
        const newDist =
          haversineKm(a.lat, a.lng, c.lat, c.lng) +
          haversineKm(b.lat, b.lng, d.lat, d.lng);

        if (newDist < currentDist - 0.01) {
          // Reverse the segment between i and j
          const segment = result.slice(i, j + 1);
          segment.reverse();
          result.splice(i, j - i + 1, ...segment);
          improved = true;
        }
      }
    }
  }

  return result;
}
