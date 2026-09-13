export type RouteStop = {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  order: number;
  lat: number;
  lng: number;
};

export type RouteLeg = {
  fromId: string;
  toId: string;
  distanceKm: number;
  estimatedMinutes: number;
};

export type BacktrackingReport = {
  detected: boolean;
  description: string;
  segments: { fromTitle: string; toTitle: string; issue: string }[];
};

export type RouteOptimizationResult = {
  originalOrder: RouteStop[];
  optimizedOrder: RouteStop[];
  originalLegs: RouteLeg[];
  optimizedLegs: RouteLeg[];
  originalTotalKm: number;
  optimizedTotalKm: number;
  distanceSavedKm: number;
  originalTotalMinutes: number;
  optimizedTotalMinutes: number;
  timeSavedMinutes: number;
  backtracking: BacktrackingReport;
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const DEFAULT_CENTER_LAT = 20.5937;
const DEFAULT_CENTER_LNG = 78.9629;
const SPREAD = 0.08;

export function syntheticCoordinates(
  title: string,
  category: string,
  center?: { lat: number; lng: number },
): { lat: number; lng: number } {
  const centerLat = center?.lat ?? DEFAULT_CENTER_LAT;
  const centerLng = center?.lng ?? DEFAULT_CENTER_LNG;
  const h = hashString(title + category);
  const latOffset = ((h % 10000) / 10000 - 0.5) * 2 * SPREAD;
  const lngOffset = (((h >> 8) % 10000) / 10000 - 0.5) * 2 * SPREAD;
  return {
    lat: Math.round((centerLat + latOffset) * 10000) / 10000,
    lng: Math.round((centerLng + lngOffset) * 10000) / 10000,
  };
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function estimateTravelMinutes(distanceKm: number): number {
  const avgSpeedKmh = 25;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

function computeLegs(stops: RouteStop[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const dist = haversineKm(
      stops[i].lat,
      stops[i].lng,
      stops[i + 1].lat,
      stops[i + 1].lng,
    );
    legs.push({
      fromId: stops[i].id,
      toId: stops[i + 1].id,
      distanceKm: dist,
      estimatedMinutes: estimateTravelMinutes(dist),
    });
  }
  return legs;
}

function totalDistance(legs: RouteLeg[]): number {
  return Math.round(legs.reduce((s, l) => s + l.distanceKm, 0) * 100) / 100;
}

function totalMinutes(legs: RouteLeg[]): number {
  return legs.reduce((s, l) => s + l.estimatedMinutes, 0);
}

function detectBacktracking(
  stops: RouteStop[],
): BacktrackingReport {
  if (stops.length < 3) {
    return { detected: false, description: "Too few stops to detect backtracking", segments: [] };
  }

  const segments: BacktrackingReport["segments"] = [];

  for (let i = 0; i < stops.length - 2; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const c = stops[i + 2];

    const abDist = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const bcDist = haversineKm(b.lat, b.lng, c.lat, c.lng);
    const acDist = haversineKm(a.lat, a.lng, c.lat, c.lng);

    if (abDist + bcDist > acDist * 1.6 && abDist > 0.5 && bcDist > 0.5) {
      segments.push({
        fromTitle: a.title,
        toTitle: c.title,
        issue: `Route goes from "${a.title}" to "${b.title}" then to "${c.title}", but "${c.title}" is closer to "${a.title}" (${acDist.toFixed(1)} km direct vs ${(abDist + bcDist).toFixed(1)} km via "${b.title}")`,
      });
    }
  }

  return {
    detected: segments.length > 0,
    description:
      segments.length > 0
        ? `Found ${segments.length} backtracking segment(s) where the route zigzags instead of moving in one direction`
        : "No material backtracking detected",
    segments,
  };
}

function nearestNeighborOrder(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 2) return [...stops];

  const result: RouteStop[] = [stops[0]];
  const remaining = new Set(stops.slice(1));

  while (remaining.size > 0) {
    const current = result[result.length - 1];
    let nearest: RouteStop | null = null;
    let nearestDist = Infinity;

    for (const stop of remaining) {
      const dist = haversineKm(current.lat, current.lng, stop.lat, stop.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = stop;
      }
    }

    if (nearest) {
      remaining.delete(nearest);
      result.push(nearest);
    }
  }

  return result;
}

export function optimizeRoute(stops: RouteStop[]): RouteOptimizationResult {
  if (stops.length === 0) {
    return {
      originalOrder: [],
      optimizedOrder: [],
      originalLegs: [],
      optimizedLegs: [],
      originalTotalKm: 0,
      optimizedTotalKm: 0,
      distanceSavedKm: 0,
      originalTotalMinutes: 0,
      optimizedTotalMinutes: 0,
      timeSavedMinutes: 0,
      backtracking: { detected: false, description: "No stops to optimize", segments: [] },
    };
  }

  const originalOrder = [...stops];
  const backtracking = detectBacktracking(originalOrder);
  const originalLegs = computeLegs(originalOrder);

  const optimizedOrder = nearestNeighborOrder(stops);
  const optimizedLegs = computeLegs(optimizedOrder);

  const origKm = totalDistance(originalLegs);
  const optKm = totalDistance(optimizedLegs);
  const origMin = totalMinutes(originalLegs);
  const optMin = totalMinutes(optimizedLegs);

  return {
    originalOrder,
    optimizedOrder,
    originalLegs,
    optimizedLegs,
    originalTotalKm: origKm,
    optimizedTotalKm: optKm,
    distanceSavedKm: Math.round((origKm - optKm) * 100) / 100,
    originalTotalMinutes: origMin,
    optimizedTotalMinutes: optMin,
    timeSavedMinutes: origMin - optMin,
    backtracking,
  };
}
