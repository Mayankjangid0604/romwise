/**
 * Time-slot helpers for manually appending an item to an itinerary day.
 *
 * Kept pure (no DB access) so the scheduling rules are unit-testable.
 */

const DAY_START = "09:00";
const DEFAULT_DURATION_MINUTES = 120;
const GAP_AFTER_PREVIOUS_MINUTES = 15;
/** Latest start we will schedule; anything later cannot fit before midnight. */
const LATEST_START_MINUTES = 23 * 60;
const END_OF_DAY_MINUTES = 23 * 60 + 59;

export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type AppendSlot =
  | { ok: true; startTime: string; endTime: string }
  | { ok: false; reason: string };

/**
 * Compute the slot for an item appended after the day's last item.
 *
 * - Empty day → starts at 09:00.
 * - Otherwise → starts 15 minutes after the previous item ends.
 * - Duration uses the place's known duration, else 2 hours, and is clamped to 23:59.
 * - Refuses (instead of producing "24:10"-style times) when the day is already full.
 */
export function computeAppendSlot(
  previousEndTime: string | null,
  durationMinutes: number | null | undefined,
): AppendSlot {
  let start = timeToMinutes(DAY_START)!;

  if (previousEndTime) {
    const prevEnd = timeToMinutes(previousEndTime);
    if (prevEnd !== null) start = prevEnd + GAP_AFTER_PREVIOUS_MINUTES;
  }

  if (start > LATEST_START_MINUTES) {
    return {
      ok: false,
      reason: `This day is already full (last activity ends at ${previousEndTime}). Add it to another day, or shorten an earlier activity.`,
    };
  }

  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : DEFAULT_DURATION_MINUTES;
  const end = Math.min(start + duration, END_OF_DAY_MINUTES);

  return { ok: true, startTime: minutesToTime(start), endTime: minutesToTime(end) };
}
