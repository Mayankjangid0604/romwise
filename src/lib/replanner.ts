export type ReplanItem = {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  order: number;
  isTimeSensitive: boolean;
};

export type DisruptionType = "delayed" | "skipped";

export type DisruptionInput = {
  disruptedItemId: string;
  type: DisruptionType;
  delayMinutes?: number;
};

export type ReplanChange = {
  itemId: string;
  title: string;
  action: "removed" | "shifted" | "kept" | "skipped";
  previousStartTime: string;
  previousEndTime: string;
  newStartTime: string | null;
  newEndTime: string | null;
  reason: string;
};

export type ReplanProposal = {
  conflictSummary: string;
  changes: ReplanChange[];
  previousState: ReplanItem[];
  proposedState: ReplanItem[];
  hasConflict: boolean;
};

const CATEGORY_PRIORITY: Record<string, number> = {
  dining: 7,
  sightseeing: 8,
  culture: 7,
  nature: 6,
  adventure: 5,
  relaxation: 4,
  shopping: 3,
  nightlife: 3,
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function itemDuration(item: ReplanItem): number {
  return parseTime(item.endTime) - parseTime(item.startTime);
}

export function proposeReplan(
  items: ReplanItem[],
  disruption: DisruptionInput,
): ReplanProposal {
  const sorted = [...items].sort(
    (a, b) => parseTime(a.startTime) - parseTime(b.startTime),
  );
  const previousState = sorted.map((i) => ({ ...i }));

  const disruptedIndex = sorted.findIndex(
    (i) => i.id === disruption.disruptedItemId,
  );

  if (disruptedIndex === -1) {
    return {
      conflictSummary: "Disrupted item not found in today's itinerary",
      changes: [],
      previousState,
      proposedState: previousState,
      hasConflict: false,
    };
  }

  const disrupted = sorted[disruptedIndex];

  if (disruption.type === "skipped") {
    return handleSkip(sorted, disruptedIndex, previousState);
  }

  const delayMinutes = disruption.delayMinutes ?? 30;
  return handleDelay(sorted, disruptedIndex, delayMinutes, previousState);
}

function handleSkip(
  sorted: ReplanItem[],
  skipIndex: number,
  previousState: ReplanItem[],
): ReplanProposal {
  const skipped = sorted[skipIndex];
  const changes: ReplanChange[] = [];
  const proposed: ReplanItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i === skipIndex) {
      changes.push({
        itemId: skipped.id,
        title: skipped.title,
        action: "skipped",
        previousStartTime: skipped.startTime,
        previousEndTime: skipped.endTime,
        newStartTime: null,
        newEndTime: null,
        reason: `"${skipped.title}" was skipped by the user`,
      });
      continue;
    }

    proposed.push({ ...sorted[i] });
    changes.push({
      itemId: sorted[i].id,
      title: sorted[i].title,
      action: "kept",
      previousStartTime: sorted[i].startTime,
      previousEndTime: sorted[i].endTime,
      newStartTime: sorted[i].startTime,
      newEndTime: sorted[i].endTime,
      reason: "No change needed — item is not affected by the skip",
    });
  }

  return {
    conflictSummary: `"${skipped.title}" was skipped. Remaining items keep their original times.`,
    changes,
    previousState,
    proposedState: proposed,
    hasConflict: false,
  };
}

function handleDelay(
  sorted: ReplanItem[],
  delayIndex: number,
  delayMinutes: number,
  previousState: ReplanItem[],
): ReplanProposal {
  const delayed = sorted[delayIndex];
  const delayedEnd = parseTime(delayed.endTime) + delayMinutes;
  const changes: ReplanChange[] = [];
  const proposed: ReplanItem[] = [];

  const newDelayedStart = formatTime(
    parseTime(delayed.startTime) + delayMinutes,
  );
  const newDelayedEnd = formatTime(delayedEnd);

  changes.push({
    itemId: delayed.id,
    title: delayed.title,
    action: "shifted",
    previousStartTime: delayed.startTime,
    previousEndTime: delayed.endTime,
    newStartTime: newDelayedStart,
    newEndTime: newDelayedEnd,
    reason: `"${delayed.title}" delayed by ${delayMinutes} minutes`,
  });
  proposed.push({
    ...delayed,
    startTime: newDelayedStart,
    endTime: newDelayedEnd,
  });

  for (let i = 0; i < sorted.length; i++) {
    if (i === delayIndex) continue;
    if (i < delayIndex) {
      proposed.push({ ...sorted[i] });
      changes.push({
        itemId: sorted[i].id,
        title: sorted[i].title,
        action: "kept",
        previousStartTime: sorted[i].startTime,
        previousEndTime: sorted[i].endTime,
        newStartTime: sorted[i].startTime,
        newEndTime: sorted[i].endTime,
        reason: "Occurs before the disrupted item — unaffected",
      });
      continue;
    }

    const item = sorted[i];
    const itemStart = parseTime(item.startTime);

    if (itemStart >= delayedEnd) {
      proposed.push({ ...item });
      changes.push({
        itemId: item.id,
        title: item.title,
        action: "kept",
        previousStartTime: item.startTime,
        previousEndTime: item.endTime,
        newStartTime: item.startTime,
        newEndTime: item.endTime,
        reason: "Starts after the delayed item ends — no conflict",
      });
      continue;
    }

    if (item.isTimeSensitive) {
      proposed.push({ ...item });
      changes.push({
        itemId: item.id,
        title: item.title,
        action: "kept",
        previousStartTime: item.startTime,
        previousEndTime: item.endTime,
        newStartTime: item.startTime,
        newEndTime: item.endTime,
        reason: `Time-sensitive item protected — cannot be moved`,
      });
      continue;
    }

    const timeSensitiveLater = sorted
      .slice(i + 1)
      .some((s) => s.isTimeSensitive);
    const priority = CATEGORY_PRIORITY[item.category] ?? 5;

    if (timeSensitiveLater && priority <= 5) {
      changes.push({
        itemId: item.id,
        title: item.title,
        action: "removed",
        previousStartTime: item.startTime,
        previousEndTime: item.endTime,
        newStartTime: null,
        newEndTime: null,
        reason: `Removed to protect a time-sensitive item later — "${item.title}" has lower priority (${item.category}, score ${priority}/10)`,
      });
      continue;
    }

    const duration = itemDuration(item);
    const newStart = formatTime(delayedEnd);
    const newEnd = formatTime(delayedEnd + duration);

    proposed.push({
      ...item,
      startTime: newStart,
      endTime: newEnd,
    });
    changes.push({
      itemId: item.id,
      title: item.title,
      action: "shifted",
      previousStartTime: item.startTime,
      previousEndTime: item.endTime,
      newStartTime: newStart,
      newEndTime: newEnd,
      reason: `Shifted later by ${delayMinutes} minutes due to cascade from delay`,
    });
  }

  proposed.sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  const hasConflict = changes.some(
    (c) => c.action === "removed" || c.action === "shifted",
  );
  const removedCount = changes.filter((c) => c.action === "removed").length;
  const shiftedCount = changes.filter((c) => c.action === "shifted").length;

  let conflictSummary = `"${delayed.title}" delayed by ${delayMinutes} minutes.`;
  if (removedCount > 0) {
    conflictSummary += ` ${removedCount} lower-priority item(s) removed to protect time-sensitive activities.`;
  }
  if (shiftedCount > 1) {
    conflictSummary += ` ${shiftedCount - 1} item(s) shifted later.`;
  }

  return {
    conflictSummary,
    changes,
    previousState,
    proposedState: proposed,
    hasConflict,
  };
}
