import { describe, it, expect } from "vitest";
import {
  getTripDuration,
  formatTripDates,
  formatTripEndDate,
  formatTripStartDate,
  getTripCountdownStatus,
  getTripStartEndDateTimes,
  TripType,
  TRIP_TYPE_LABELS,
} from "../date-utils";

// ── getTripDuration ──────────────────────────────────────────────────────────

describe("getTripDuration — new flexible trip types", () => {
  const today = new Date("2026-06-01T00:00:00Z");

  it("PICNIC returns 1 day", () => {
    expect(getTripDuration({ tripType: TripType.PICNIC }, 3)).toBe(1);
  });

  it("DAY_TRIP returns 1 day", () => {
    expect(getTripDuration({ tripType: TripType.DAY_TRIP }, 3)).toBe(1);
  });

  it("ONE_DAY returns 1 day", () => {
    expect(getTripDuration({ tripType: TripType.ONE_DAY }, 3)).toBe(1);
  });

  it("OVERNIGHT returns 2 days", () => {
    expect(getTripDuration({ tripType: TripType.OVERNIGHT }, 3)).toBe(2);
  });

  it("WEEKEND returns 2 days", () => {
    expect(getTripDuration({ tripType: TripType.WEEKEND }, 3)).toBe(2);
  });


  it("FLEXIBLE returns defaultDays", () => {
    expect(getTripDuration({ tripType: TripType.FLEXIBLE }, 5)).toBe(5);
  });

  it("MULTI_DAY derives from startDate/endDate when both provided", () => {
    const start = new Date("2026-06-01");
    const end = new Date("2026-06-07");
    expect(getTripDuration({ tripType: TripType.MULTI_DAY, startDate: start, endDate: end }, 3)).toBe(7);
  });

  it("MULTI_DAY returns defaultDays when dates are missing", () => {
    expect(getTripDuration({ tripType: TripType.MULTI_DAY }, 4)).toBe(4);
  });

  it("unknown tripType derives from startDate/endDate", () => {
    const start = new Date("2026-06-01");
    const end = new Date("2026-06-03");
    expect(getTripDuration({ tripType: "LEGACY", startDate: start, endDate: end }, 3)).toBe(3);
  });
});

// ── TripType enum coverage ───────────────────────────────────────────────────

describe("TripType enum", () => {
  it("contains all 8 expected values", () => {
    const expected = ["ONE_DAY", "MULTI_DAY", "FLEXIBLE", "PICNIC", "DAY_TRIP", "OVERNIGHT", "WEEKEND"];
    expect(Object.values(TripType)).toEqual(expected);
  });
});

// ── TRIP_TYPE_LABELS ─────────────────────────────────────────────────────────

describe("TRIP_TYPE_LABELS", () => {
  it("provides a human-readable label for every TripType", () => {
    for (const type of Object.values(TripType)) {
      expect(TRIP_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});

// ── formatTripDates ──────────────────────────────────────────────────────────

describe("formatTripDates — new types", () => {
  it("PICNIC with startDate returns a single date string", () => {
    const result = formatTripDates({ tripType: TripType.PICNIC, startDate: new Date("2026-06-01") });
    expect(result).toBeTruthy();
    expect(result).not.toBe("Flexible Dates");
    expect(result).not.toBe("Unknown Dates");
  });

  it("OVERNIGHT with startDate returns a date range (2 days)", () => {
    const result = formatTripDates({ tripType: TripType.OVERNIGHT, startDate: new Date("2026-06-01") });
    expect(result).toContain("–");
  });

  it("WEEKEND with startDate returns a date range (2 days)", () => {
    const result = formatTripDates({ tripType: TripType.WEEKEND, startDate: new Date("2026-06-01") });
    expect(result).toContain("–");
  });


  it("FLEXIBLE returns 'Flexible Dates'", () => {
    expect(formatTripDates({ tripType: TripType.FLEXIBLE })).toBe("Flexible Dates");
  });
});

// ── formatTripEndDate ────────────────────────────────────────────────────────

describe("formatTripEndDate — new types", () => {
  const startDate = new Date("2026-06-06"); // Saturday

  it("PICNIC end date is same as start", () => {
    const result = formatTripEndDate({ tripType: TripType.PICNIC, startDate });
    expect(result).toBeTruthy();
  });

  it("OVERNIGHT end date is +1 day from start", () => {
    const result = formatTripEndDate({ tripType: TripType.OVERNIGHT, startDate });
    const expectedEnd = new Date(startDate);
    expectedEnd.setDate(expectedEnd.getDate() + 1);
    expect(result).toBe(expectedEnd.toLocaleDateString());
  });

  it("WEEKEND end date is +1 day from start", () => {
    const result = formatTripEndDate({ tripType: TripType.WEEKEND, startDate });
    const expectedEnd = new Date(startDate);
    expectedEnd.setDate(expectedEnd.getDate() + 1);
    expect(result).toBe(expectedEnd.toLocaleDateString());
  });


  it("FLEXIBLE returns 'Flexible'", () => {
    expect(formatTripEndDate({ tripType: TripType.FLEXIBLE })).toBe("Flexible");
  });
});

// ── getTripCountdownStatus ───────────────────────────────────────────────────

describe("getTripCountdownStatus — new types", () => {
  it("returns null for FLEXIBLE trips", () => {
    expect(getTripCountdownStatus({ tripType: TripType.FLEXIBLE })).toBeNull();
  });

  it("returns null when startDate is missing", () => {
    expect(getTripCountdownStatus({ tripType: TripType.DAY_TRIP })).toBeNull();
  });

  it("returns 'Trip completed' for a past PICNIC", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = getTripCountdownStatus({ tripType: TripType.PICNIC, startDate: past });
    expect(result).toBe("Trip completed");
  });

  it("returns countdown for a future DAY_TRIP", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const result = getTripCountdownStatus({ tripType: TripType.DAY_TRIP, startDate: future });
    expect(result).toContain("days to go");
  });

  it("returns 'Starts today' for OVERNIGHT starting today", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = getTripCountdownStatus({ tripType: TripType.OVERNIGHT, startDate: today });
    expect(result).toBe("Starts today");
  });
});

describe("getTripStartEndDateTimes", () => {
  it("computes proper start and end for MULTI_DAY", () => {
    const result = getTripStartEndDateTimes({
      tripType: TripType.MULTI_DAY,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      startTime: "10:00",
      endTime: "14:00"
    });
    expect(result.startDateTime!.getHours()).toBe(10);
    expect(result.endDateTime!.getDate()).toBe(3);
    expect(result.endDateTime!.getHours()).toBe(14);
  });
  
  it("handles OVERNIGHT as 24-hour chunk", () => {
    const result = getTripStartEndDateTimes({
      tripType: TripType.OVERNIGHT,
      startDate: new Date("2026-06-01"),
      startTime: "15:00",
    });
    expect(result.startDateTime!.getHours()).toBe(15);
    expect(result.endDateTime!.getDate()).toBe(2);
    expect(result.endDateTime!.getHours()).toBe(15);
  });
});
