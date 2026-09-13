import { describe, it, expect } from "vitest";
import { generatePackingList, type PackingInput } from "../packing";

describe("generatePackingList", () => {
  it("returns base items for a short trip", () => {
    const input: PackingInput = { durationDays: 3, accessibilityNotes: [] };
    const items = generatePackingList(input);

    expect(items.length).toBe(27);
    expect(items.some((i) => i.label === "Passport / ID")).toBe(true);
    expect(items.some((i) => i.label === "Phone charger")).toBe(true);
    expect(items.some((i) => i.label === "Snacks for travel")).toBe(true);
  });

  it("adds long-trip items when duration >= 5 days", () => {
    const short = generatePackingList({ durationDays: 4, accessibilityNotes: [] });
    const long = generatePackingList({ durationDays: 5, accessibilityNotes: [] });

    expect(long.length).toBe(short.length + 5);
    expect(long.some((i) => i.label === "Laundry detergent sachets")).toBe(true);
    expect(long.some((i) => i.label === "Travel pillow")).toBe(true);
    expect(short.some((i) => i.label === "Laundry detergent sachets")).toBe(false);
  });

  it("adds wheelchair accessibility items", () => {
    const items = generatePackingList({
      durationDays: 3,
      accessibilityNotes: ["Wheelchair user"],
    });

    expect(items.some((i) => i.label === "Wheelchair rain cover")).toBe(true);
    expect(items.some((i) => i.label === "Portable ramp")).toBe(true);
  });

  it("adds mobility accessibility items", () => {
    const items = generatePackingList({
      durationDays: 3,
      accessibilityNotes: ["Limited mobility"],
    });

    expect(items.some((i) => i.label === "Walking stick / cane")).toBe(true);
    expect(items.some((i) => i.label === "Compression socks")).toBe(true);
  });

  it("adds hearing accessibility items", () => {
    const items = generatePackingList({
      durationDays: 3,
      accessibilityNotes: ["hearing impaired"],
    });

    expect(items.some((i) => i.label === "Hearing aid batteries")).toBe(true);
  });

  it("adds vision accessibility items", () => {
    const items = generatePackingList({
      durationDays: 3,
      accessibilityNotes: ["low vision"],
    });

    expect(items.some((i) => i.label === "Spare glasses / contacts")).toBe(true);
  });

  it("adds medication-related items", () => {
    const items = generatePackingList({
      durationDays: 3,
      accessibilityNotes: ["requires medication"],
    });

    expect(items.some((i) => i.label === "Pill organizer")).toBe(true);
    expect(items.some((i) => i.label === "Doctor's prescription copy")).toBe(true);
  });

  it("handles multiple accessibility notes without duplicates", () => {
    const items = generatePackingList({
      durationDays: 7,
      accessibilityNotes: ["wheelchair", "needs medication schedule"],
    });

    const labels = items.map((i) => i.label);
    const unique = new Set(labels);
    expect(labels.length).toBe(unique.size);
    expect(items.some((i) => i.label === "Wheelchair rain cover")).toBe(true);
    expect(items.some((i) => i.label === "Pill organizer")).toBe(true);
    expect(items.some((i) => i.label === "Laundry detergent sachets")).toBe(true);
  });

  it("marks essential items correctly", () => {
    const items = generatePackingList({ durationDays: 3, accessibilityNotes: [] });

    const passport = items.find((i) => i.label === "Passport / ID");
    expect(passport?.essential).toBe(true);

    const sunglasses = items.find((i) => i.label === "Sunglasses");
    expect(sunglasses?.essential).toBe(false);
  });

  it("is deterministic — same input produces same output", () => {
    const input: PackingInput = { durationDays: 6, accessibilityNotes: ["wheelchair"] };
    const a = generatePackingList(input);
    const b = generatePackingList(input);

    expect(a).toEqual(b);
  });

  it("assigns valid categories to all items", () => {
    const validCategories = [
      "clothing", "toiletries", "electronics", "documents",
      "health", "accessories", "misc",
    ];
    const items = generatePackingList({
      durationDays: 10,
      accessibilityNotes: ["wheelchair", "hearing", "vision", "mobility", "medication"],
    });

    for (const item of items) {
      expect(validCategories).toContain(item.category);
    }
  });

  it("works end-to-end with comma-separated accessibility notes string", () => {
    const rawNotes = "wheelchair user, needs medication schedule";
    const accessibilityNotes = rawNotes.split(",").map((s) => s.trim());
    const items = generatePackingList({ durationDays: 3, accessibilityNotes });

    expect(items.some((i) => i.label === "Wheelchair rain cover")).toBe(true);
    expect(items.some((i) => i.label === "Portable ramp")).toBe(true);
    expect(items.some((i) => i.label === "Pill organizer")).toBe(true);
    expect(items.some((i) => i.label === "Doctor's prescription copy")).toBe(true);
    expect(items.some((i) => i.label === "Hearing aid batteries")).toBe(false);
  });
});
