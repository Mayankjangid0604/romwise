import * as fs from 'fs';

let content = fs.readFileSync('src/lib/trip-brain.ts', 'utf-8');

const newFunc = `
function computeDayWindow(
  tripType: string,
  dayIdx: number,
  dayCount: number,
  startDateTime: Date | null,
  endDateTime: Date | null,
  paceLevel: PaceLevel,
  inputStartTime: string | null,
  inputEndTime: string | null
): { dayStartMins: number; dayEndMins: number } {
  let dayStartMins = DAY_START_BY_PACE[paceLevel];
  let dayEndMins = 18 * 60; // 6 PM default

  if (tripType === TripType.PICNIC) {
    dayStartMins = 10 * 60;
    dayEndMins = 16 * 60;
  }

  if (startDateTime && endDateTime) {
    if (dayCount === 1) {
      dayStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
      dayEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
    } else if (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND) {
      if (dayIdx === 0) {
        dayStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
      } else {
        dayStartMins = 8 * 60; // Morning default
      }

      if (dayIdx === dayCount - 1) {
        dayEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
      } else {
        dayEndMins = 22 * 60; // Late evening default
      }
    } else {
      // MULTI_DAY: Keep pre-Phase-2 uniform full-day behavior.
      dayStartMins = DAY_START_BY_PACE[paceLevel];
      dayEndMins = 18 * 60; 
    }
  } else {
    if (inputStartTime) {
      const [h, m] = inputStartTime.split(':').map(Number);
      if (dayCount === 1 || (dayIdx === 0 && (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND))) {
        dayStartMins = h * 60 + m;
      }
    }
    if (inputEndTime) {
      const [h, m] = inputEndTime.split(':').map(Number);
      if (dayCount === 1 || (dayIdx === dayCount - 1 && (tripType === TripType.OVERNIGHT || tripType === TripType.WEEKEND))) {
        dayEndMins = h * 60 + m;
      }
    }
  }

  return { dayStartMins, dayEndMins };
}

// ── Deterministic fallback ─────────────────────────────────────────────────────
`;

content = content.replace("// ── Deterministic fallback ─────────────────────────────────────────────────────", newFunc);

fs.writeFileSync('src/lib/trip-brain.ts', content);
