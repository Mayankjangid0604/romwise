import { describe, it, expect } from "vitest";
import { deriveTripTypeFromDates, getTripDuration, TripType } from "../date-utils";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("deriveTripTypeFromDates (New Trip form)", () => {
  it.each([
    ["2026-10-16", "2026-10-16", TripType.DAY_TRIP, 1],
    ["2026-10-16", "2026-10-17", TripType.OVERNIGHT, 2],
    // Regression: a 3-calendar-day range used to become WEEKEND (fixed 2 days) and lost its last day
    ["2026-10-16", "2026-10-18", TripType.MULTI_DAY, 3],
    ["2026-10-16", "2026-10-22", TripType.MULTI_DAY, 7],
  ])("%s → %s is %s and plans %i day(s)", (start, end, type, days) => {
    const tripType = deriveTripTypeFromDates(d(start), d(end));
    expect(tripType).toBe(type);
    expect(getTripDuration({ startDate: d(start), endDate: d(end), tripType })).toBe(days);
  });
});

describe("getTripDuration counts calendar days", () => {
  it("is not inflated by time-of-day on the start/end datetimes (V2 planner input)", () => {
    // Regression: ceil(2d 11h) + 1 produced 4 days for a Nov 13–15 trip
    const startDate = new Date("2026-11-13T09:00:00Z");
    const endDate = new Date("2026-11-15T20:00:00Z");
    expect(getTripDuration({ startDate, endDate, tripType: TripType.MULTI_DAY })).toBe(3);
  });

  it("matches the planner's own start/end computation for a form-created trip", async () => {
    const { getTripStartEndDateTimes } = await import("../date-utils");
    const trip = { startDate: d("2026-11-13"), endDate: d("2026-11-15"), tripType: TripType.MULTI_DAY };
    const { startDateTime, endDateTime } = getTripStartEndDateTimes(trip);
    expect(getTripDuration({ startDate: startDateTime, endDate: endDateTime, tripType: trip.tripType })).toBe(3);
  });
});
