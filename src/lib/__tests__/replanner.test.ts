import { describe, it, expect } from "vitest";
import { proposeReplan, type ReplanItem, type DisruptionInput } from "../replanner";

function makeItems(): ReplanItem[] {
  return [
    { id: "1", title: "Breakfast", category: "dining", startTime: "08:00", endTime: "09:00", order: 1, isTimeSensitive: true },
    { id: "2", title: "Temple visit", category: "culture", startTime: "09:30", endTime: "11:00", order: 2, isTimeSensitive: false },
    { id: "3", title: "Shopping", category: "shopping", startTime: "11:30", endTime: "13:00", order: 3, isTimeSensitive: false },
    { id: "4", title: "Lunch", category: "dining", startTime: "13:30", endTime: "14:30", order: 4, isTimeSensitive: false },
    { id: "5", title: "Sunset viewing", category: "nature", startTime: "17:00", endTime: "18:30", order: 5, isTimeSensitive: true },
    { id: "6", title: "Dinner", category: "dining", startTime: "19:00", endTime: "20:30", order: 6, isTimeSensitive: true },
  ];
}

describe("proposeReplan — skip", () => {
  it("removes the skipped item and keeps everything else", () => {
    const items = makeItems();
    const disruption: DisruptionInput = { disruptedItemId: "3", type: "skipped" };
    const result = proposeReplan(items, disruption);

    expect(result.proposedState).toHaveLength(5);
    expect(result.proposedState.find((i) => i.id === "3")).toBeUndefined();
    expect(result.hasConflict).toBe(false);
  });

  it("preserves times of remaining items on skip", () => {
    const items = makeItems();
    const disruption: DisruptionInput = { disruptedItemId: "2", type: "skipped" };
    const result = proposeReplan(items, disruption);

    const kept = result.proposedState;
    for (const item of kept) {
      const original = items.find((i) => i.id === item.id)!;
      expect(item.startTime).toBe(original.startTime);
      expect(item.endTime).toBe(original.endTime);
    }
  });

  it("reports the skipped item in changes", () => {
    const items = makeItems();
    const disruption: DisruptionInput = { disruptedItemId: "3", type: "skipped" };
    const result = proposeReplan(items, disruption);

    const skippedChange = result.changes.find((c) => c.itemId === "3");
    expect(skippedChange?.action).toBe("skipped");
  });
});

describe("proposeReplan — delay", () => {
  it("shifts the delayed item later", () => {
    const items = makeItems();
    const disruption: DisruptionInput = {
      disruptedItemId: "2",
      type: "delayed",
      delayMinutes: 30,
    };
    const result = proposeReplan(items, disruption);

    const shifted = result.changes.find((c) => c.itemId === "2");
    expect(shifted?.action).toBe("shifted");
    expect(shifted?.newStartTime).toBe("10:00");
    expect(shifted?.newEndTime).toBe("11:30");
  });

  it("protects time-sensitive items from removal", () => {
    const items = makeItems();
    const disruption: DisruptionInput = {
      disruptedItemId: "2",
      type: "delayed",
      delayMinutes: 60,
    };
    const result = proposeReplan(items, disruption);

    const sunsetChange = result.changes.find((c) => c.itemId === "5");
    expect(sunsetChange?.action).toBe("kept");

    const dinnerChange = result.changes.find((c) => c.itemId === "6");
    expect(dinnerChange?.action).toBe("kept");
  });

  it("removes lower-priority items to protect time-sensitive ones", () => {
    const items: ReplanItem[] = [
      { id: "1", title: "Morning walk", category: "nature", startTime: "08:00", endTime: "09:30", order: 1, isTimeSensitive: false },
      { id: "2", title: "Shopping", category: "shopping", startTime: "10:00", endTime: "11:30", order: 2, isTimeSensitive: false },
      { id: "3", title: "Sunset dinner", category: "dining", startTime: "12:00", endTime: "13:30", order: 3, isTimeSensitive: true },
    ];
    const disruption: DisruptionInput = {
      disruptedItemId: "1",
      type: "delayed",
      delayMinutes: 90,
    };
    const result = proposeReplan(items, disruption);

    const shoppingChange = result.changes.find((c) => c.itemId === "2");
    expect(shoppingChange?.action).toBe("removed");
    expect(shoppingChange?.reason).toContain("lower priority");

    const dinnerChange = result.changes.find((c) => c.itemId === "3");
    expect(dinnerChange?.action).toBe("kept");
  });

  it("defaults to 30 minute delay if not specified", () => {
    const items = makeItems();
    const disruption: DisruptionInput = {
      disruptedItemId: "2",
      type: "delayed",
    };
    const result = proposeReplan(items, disruption);

    const shifted = result.changes.find((c) => c.itemId === "2");
    expect(shifted?.newStartTime).toBe("10:00");
  });

  it("does not modify items before the disrupted one", () => {
    const items = makeItems();
    const disruption: DisruptionInput = {
      disruptedItemId: "3",
      type: "delayed",
      delayMinutes: 30,
    };
    const result = proposeReplan(items, disruption);

    const breakfastChange = result.changes.find((c) => c.itemId === "1");
    expect(breakfastChange?.action).toBe("kept");
    const templeChange = result.changes.find((c) => c.itemId === "2");
    expect(templeChange?.action).toBe("kept");
  });

  it("does not modify items that start after the delayed item ends", () => {
    const items = makeItems();
    const disruption: DisruptionInput = {
      disruptedItemId: "2",
      type: "delayed",
      delayMinutes: 15,
    };
    const result = proposeReplan(items, disruption);

    const lunchChange = result.changes.find((c) => c.itemId === "4");
    expect(lunchChange?.action).toBe("kept");
  });
});

describe("proposeReplan — does not mutate input", () => {
  it("original items array is unchanged", () => {
    const items = makeItems();
    const originalJson = JSON.stringify(items);

    proposeReplan(items, { disruptedItemId: "2", type: "delayed", delayMinutes: 60 });

    expect(JSON.stringify(items)).toBe(originalJson);
  });

  it("previousState matches original items", () => {
    const items = makeItems();
    const result = proposeReplan(items, {
      disruptedItemId: "3",
      type: "skipped",
    });

    expect(result.previousState).toHaveLength(items.length);
    for (const prev of result.previousState) {
      const orig = items.find((i) => i.id === prev.id)!;
      expect(prev.startTime).toBe(orig.startTime);
      expect(prev.endTime).toBe(orig.endTime);
    }
  });
});

describe("proposeReplan — edge cases", () => {
  it("returns no conflict for unknown item id", () => {
    const items = makeItems();
    const result = proposeReplan(items, {
      disruptedItemId: "nonexistent",
      type: "skipped",
    });
    expect(result.hasConflict).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("handles single-item itinerary skip", () => {
    const items: ReplanItem[] = [
      { id: "1", title: "Only item", category: "dining", startTime: "09:00", endTime: "10:00", order: 1, isTimeSensitive: false },
    ];
    const result = proposeReplan(items, { disruptedItemId: "1", type: "skipped" });
    expect(result.proposedState).toHaveLength(0);
  });

  it("handles single-item itinerary delay", () => {
    const items: ReplanItem[] = [
      { id: "1", title: "Only item", category: "dining", startTime: "09:00", endTime: "10:00", order: 1, isTimeSensitive: false },
    ];
    const result = proposeReplan(items, {
      disruptedItemId: "1",
      type: "delayed",
      delayMinutes: 30,
    });
    expect(result.proposedState).toHaveLength(1);
    expect(result.proposedState[0].startTime).toBe("09:30");
  });

  it("conflict summary mentions removal count", () => {
    const items: ReplanItem[] = [
      { id: "1", title: "Walk", category: "nature", startTime: "08:00", endTime: "09:30", order: 1, isTimeSensitive: false },
      { id: "2", title: "Shopping", category: "shopping", startTime: "10:00", endTime: "11:30", order: 2, isTimeSensitive: false },
      { id: "3", title: "Sunset", category: "nature", startTime: "12:00", endTime: "13:30", order: 3, isTimeSensitive: true },
    ];
    const result = proposeReplan(items, {
      disruptedItemId: "1",
      type: "delayed",
      delayMinutes: 90,
    });
    expect(result.conflictSummary).toContain("removed");
  });
});
