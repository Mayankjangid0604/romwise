import type { CandidatePlaceV2 } from "./types";
import { haversineKm } from "../route-optimizer";

export type GeographicCluster = {
  id: string;
  area: string | null;
  center: { lat: number; lng: number } | null;
  places: CandidatePlaceV2[];
};

export function buildClusters(places: CandidatePlaceV2[]): GeographicCluster[] {
  const clusters: GeographicCluster[] = [];
  
  // 1. Group by explicit area
  const areaGroups = new Map<string, CandidatePlaceV2[]>();
  const noAreaPlaces: CandidatePlaceV2[] = [];

  for (const place of places) {
    if (place.area && place.area.trim() !== "") {
      const areaKey = place.area.trim().toLowerCase();
      if (!areaGroups.has(areaKey)) {
        areaGroups.set(areaKey, []);
      }
      areaGroups.get(areaKey)!.push(place);
    } else {
      noAreaPlaces.push(place);
    }
  }

  let clusterId = 1;
  for (const [area, areaPlaces] of areaGroups.entries()) {
    clusters.push({
      id: `cluster_area_${clusterId++}`,
      area,
      center: computeCenter(areaPlaces),
      places: areaPlaces,
    });
  }

  // 2. Greedy coordinate clustering for places without area
  // Threshold for being in the same cluster: 3 km
  const DISTANCE_THRESHOLD_KM = 3.0;

  for (const place of noAreaPlaces) {
    if (place.lat === null || place.lng === null) {
      // Put in a generic "unknown" cluster
      const unknownCluster = clusters.find(c => c.id === "cluster_unknown");
      if (unknownCluster) {
        unknownCluster.places.push(place);
      } else {
        clusters.push({
          id: "cluster_unknown",
          area: null,
          center: null,
          places: [place]
        });
      }
      continue;
    }

    let added = false;
    for (const cluster of clusters) {
      if (cluster.center) {
        const dist = haversineKm(place.lat, place.lng, cluster.center.lat, cluster.center.lng);
        if (dist <= DISTANCE_THRESHOLD_KM) {
          cluster.places.push(place);
          // Update center
          cluster.center = computeCenter(cluster.places);
          added = true;
          break;
        }
      }
    }

    if (!added) {
      clusters.push({
        id: `cluster_coord_${clusterId++}`,
        area: null,
        center: { lat: place.lat, lng: place.lng },
        places: [place],
      });
    }
  }

  // Sort clusters by highest total place scores
  clusters.sort((a, b) => {
    const scoreA = a.places.reduce((sum, p) => sum + (p.v2Score?.total ?? 0), 0);
    const scoreB = b.places.reduce((sum, p) => sum + (p.v2Score?.total ?? 0), 0);
    return scoreB - scoreA;
  });

  return clusters;
}

function computeCenter(places: CandidatePlaceV2[]): { lat: number; lng: number } | null {
  const withCoords = places.filter(p => p.lat !== null && p.lng !== null);
  if (withCoords.length === 0) return null;
  
  const sumLat = withCoords.reduce((sum, p) => sum + p.lat!, 0);
  const sumLng = withCoords.reduce((sum, p) => sum + p.lng!, 0);
  return {
    lat: sumLat / withCoords.length,
    lng: sumLng / withCoords.length
  };
}
