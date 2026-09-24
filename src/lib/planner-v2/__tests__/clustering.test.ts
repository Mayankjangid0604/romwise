import { describe, it, expect } from "vitest";
import { buildClusters } from "../clustering";
import type { CandidatePlaceV2 } from "../types";

const basePlace: CandidatePlaceV2 = {
  id: "test1", name: "Test", slug: "test", category: "history",
  lat: null, lng: null, typicalCostInr: null, durationMinutes: null,
  openingTime: null, closingTime: null, bestSeason: null, description: null,
  area: null, popularityScore: 50, hiddenGem: false, preferenceScore: 10,
  accessibilityScore: null, fatigueCost: null,
};

describe("Planner V2 Clustering", () => {
  it("groups by exact area", () => {
    const places = [
      { ...basePlace, id: "p1", area: "Downtown" },
      { ...basePlace, id: "p2", area: " downtown " },
      { ...basePlace, id: "p3", area: "Uptown" },
    ];
    
    const clusters = buildClusters(places);
    
    expect(clusters.length).toBe(2);
    expect(clusters.find(c => c.area === "downtown")?.places.length).toBe(2);
    expect(clusters.find(c => c.area === "uptown")?.places.length).toBe(1);
  });

  it("groups by proximity when area is missing", () => {
    // Haversine distance < 3km should group them
    const places = [
      { ...basePlace, id: "p1", lat: 28.6139, lng: 77.2090 }, // New Delhi
      { ...basePlace, id: "p2", lat: 28.6129, lng: 77.2080 }, // Very close
      { ...basePlace, id: "p3", lat: 19.0760, lng: 72.8777 }, // Mumbai (Far)
    ];

    const clusters = buildClusters(places);
    
    // 2 clusters expected
    expect(clusters.length).toBe(2);
    
    const delhiCluster = clusters.find(c => c.places.some(p => p.id === "p1"));
    expect(delhiCluster?.places.length).toBe(2);
    
    const mumbaiCluster = clusters.find(c => c.places.some(p => p.id === "p3"));
    expect(mumbaiCluster?.places.length).toBe(1);
  });
  
  it("handles missing coordinates gracefully", () => {
    const places = [
      { ...basePlace, id: "p1", lat: null, lng: null },
      { ...basePlace, id: "p2", lat: null, lng: null },
    ];
    
    const clusters = buildClusters(places);
    
    // Groups them into a single "cluster_unknown"
    expect(clusters.length).toBe(1);
    expect(clusters[0].id).toBe("cluster_unknown");
    expect(clusters[0].places.length).toBe(2);
  });
});
