/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { generateGroundedItineraryV2 } from "../adapter";
import * as engineModule from "../engine";
import * as destinationResolver from "../../destination-resolver";
import { vi } from "vitest";
import type { TripBrainInput } from "../../trip-brain";

vi.mock("../engine", () => ({
  generateItineraryV2: vi.fn(),
}));

vi.mock("../../destination-resolver", () => ({
  resolveDestination: vi.fn(),
}));

describe("Adapter Regression Tests", () => {
  it("passes accessibilityNotes properly to the V2 Planner", async () => {
     
    vi.mocked(destinationResolver.resolveDestination).mockResolvedValue({
      id: "dest1",
      name: "Dest 1",
      parentDestinationId: null,
      ancestors: [],
      synonyms: []
    } as any);

     
    vi.mocked(engineModule.generateItineraryV2).mockResolvedValue({
      days: [{ dayNumber: 1, date: new Date(), items: [{}] }],
      metrics: { candidateCount: 1 } as any,
      unscheduledMustVisits: [],
    } as any);

    const input: TripBrainInput = {
      destination: "Goa",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
      dateStatus: "known",
      tripType: "MULTI_DAY",
      timeStatus: "UNKNOWN",
      startTime: null,
      endTime: null,
      budgetInr: 10000,
      maxTravelers: 2,
      paceLevel: "balanced",
      allPreferences: [],
      accessibilityNotes: "low walking",
    };

    await generateGroundedItineraryV2(input);

    expect(engineModule.generateItineraryV2).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibilityRequirement: "low_walking",
        allPreferences: [],
        // Oct 1–3 is 3 calendar days (this asserted 4 before the off-by-one fix, see PROGRESS.md item 9)
        budgetPerDayInr: 3333,
        destinationId: "dest1",
        limit: 100,
      }),
      3,
      "balanced",
      expect.anything(),
      undefined
    );
  });

  it("computes budgetPerDayInr correctly based on total budget and trip duration", async () => {
     
    vi.mocked(destinationResolver.resolveDestination).mockResolvedValue({
      id: "dest1",
      name: "Dest 1",
      parentDestinationId: null,
      ancestors: [],
      synonyms: []
    } as any);

     
    vi.mocked(engineModule.generateItineraryV2).mockResolvedValue({
      days: [{ dayNumber: 1, date: new Date(), items: [{}] }],
      metrics: { candidateCount: 1 } as any,
      unscheduledMustVisits: [],
    } as any);

    const input: TripBrainInput = {
      destination: "Goa",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-05"), // 5 days duration
      dateStatus: "known",
      tripType: "MULTI_DAY",
      timeStatus: "UNKNOWN",
      startTime: null,
      endTime: null,
      budgetInr: 10000,
      maxTravelers: 2,
      paceLevel: "balanced",
      allPreferences: [],
    };

    await generateGroundedItineraryV2(input);

    expect(engineModule.generateItineraryV2).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetPerDayInr: 2000, // 10000 / 5 days (was 6 days / 1667 because of the off-by-one)
      }),
      5,
      "balanced",
      expect.anything(),
      undefined
    );
  });
  
  it("handles zero/invalid duration safely by falling back to full budget", async () => {
     
    vi.mocked(destinationResolver.resolveDestination).mockResolvedValue({
      id: "dest1",
      name: "Dest 1",
      parentDestinationId: null,
      ancestors: [],
      synonyms: []
    } as any);

     
    vi.mocked(engineModule.generateItineraryV2).mockResolvedValue({
      days: [{ dayNumber: 1, date: new Date(), items: [{}] }],
      metrics: { candidateCount: 1 } as any,
      unscheduledMustVisits: [],
    } as any);

    const input: TripBrainInput = {
      destination: "Goa",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"), // 1 day duration? Wait, date-utils might return 1 for same day, let's test a case where dateStatus = unknown
      dateStatus: "unknown", // getTripDuration returns 0 for unknown
      tripType: "MULTI_DAY",
      timeStatus: "UNKNOWN",
      startTime: null,
      endTime: null,
      budgetInr: 5000,
      maxTravelers: 2,
      paceLevel: "balanced",
      allPreferences: [],
    };

    await generateGroundedItineraryV2(input);

    expect(engineModule.generateItineraryV2).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetPerDayInr: 5000, // same start and end date = a 1-day trip (was planned as 2)
      }),
      1,
      "balanced",
      expect.anything(),
      undefined
    );
  });
});
