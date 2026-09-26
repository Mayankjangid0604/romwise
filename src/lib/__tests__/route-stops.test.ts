import { describe, it, expect } from "vitest";
import { buildRouteStops, optimizeRoute, type RouteSourceItem } from "../route-optimizer";

// Jaipur-ish coordinates: generated stops plus one place added after generation
const generated: RouteSourceItem[] = [
  { id: "a", title: "Hawa Mahal", category: "history", startTime: "09:00", endTime: "09:45", order: 0, place: { lat: 26.9239, lng: 75.8267 } },
  { id: "b", title: "Amber Fort", category: "history", startTime: "10:30", endTime: "13:00", order: 1, place: { lat: 26.9855, lng: 75.8513 } },
  { id: "c", title: "City Palace", category: "history", startTime: "14:00", endTime: "15:30", order: 2, place: { lat: 26.9258, lng: 75.8237 } },
];
const addedPlace: RouteSourceItem = {
  id: "added", title: "Jal Mahal", category: "sightseeing", startTime: "15:45", endTime: "16:30", order: 3, place: { lat: 26.9535, lng: 75.8462 },
};
const customActivity: RouteSourceItem = {
  id: "custom", title: "New Activity", category: "activity", startTime: "16:45", endTime: "18:45", order: 4, place: null,
};

describe("buildRouteStops", () => {
  it("includes a place added after generation in the optimized route", () => {
    const stops = buildRouteStops([...generated, addedPlace]);
    expect(stops.map((s) => s.id)).toEqual(["a", "b", "c", "added"]);

    const result = optimizeRoute(stops);
    expect(result.optimizedOrder.map((s) => s.id).sort()).toEqual(["a", "added", "b", "c"]);
    expect(result.originalOrder).toHaveLength(4);
  });

  it("re-optimizing after an addition changes the result vs. the original set", () => {
    const before = optimizeRoute(buildRouteStops(generated));
    const after = optimizeRoute(buildRouteStops([...generated, addedPlace]));
    expect(after.originalOrder.length).toBe(before.originalOrder.length + 1);
    expect(after.originalTotalKm).not.toBe(before.originalTotalKm);
  });

  it("leaves out custom activities without a map location", () => {
    const stops = buildRouteStops([...generated, customActivity]);
    expect(stops.find((s) => s.id === "custom")).toBeUndefined();
    expect(stops).toHaveLength(3);
  });

  it("drops 0,0 placeholder coordinates and follows item order, not input order", () => {
    const zero: RouteSourceItem = { ...addedPlace, id: "zero", place: { lat: 0, lng: 0 } };
    const shuffled = [generated[2], zero, generated[0], generated[1]];
    expect(buildRouteStops(shuffled).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
