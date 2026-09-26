import { describe, it, expect } from "vitest";
import { computeAppendSlot, timeToMinutes, minutesToTime } from "../itinerary-slots";

describe("computeAppendSlot", () => {
  it("starts an empty day at 09:00 and applies the place's duration", () => {
    expect(computeAppendSlot(null, 45)).toEqual({ ok: true, startTime: "09:00", endTime: "09:45" });
  });

  it("defaults to a 2-hour slot when duration is unknown", () => {
    expect(computeAppendSlot(null, null)).toEqual({ ok: true, startTime: "09:00", endTime: "11:00" });
  });

  it("starts 15 minutes after the previous item ends", () => {
    expect(computeAppendSlot("14:50", 60)).toEqual({ ok: true, startTime: "15:05", endTime: "16:05" });
  });

  it("clamps the end time to 23:59 instead of rolling past midnight", () => {
    expect(computeAppendSlot("22:30", 120)).toEqual({ ok: true, startTime: "22:45", endTime: "23:59" });
  });

  it("refuses to schedule when the day is already full (no '24:10' times)", () => {
    const slot = computeAppendSlot("23:55", 60);
    expect(slot.ok).toBe(false);
  });

  it("ignores an unparseable previous end time and falls back to 09:00", () => {
    expect(computeAppendSlot("late", 30)).toEqual({ ok: true, startTime: "09:00", endTime: "09:30" });
  });
});

describe("time helpers", () => {
  it("round-trips HH:MM", () => {
    expect(minutesToTime(timeToMinutes("07:05")!)).toBe("07:05");
  });

  it("rejects invalid times", () => {
    expect(timeToMinutes("24:10")).toBeNull();
    expect(timeToMinutes("9am")).toBeNull();
  });
});
