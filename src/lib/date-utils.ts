export type TripDateStatus = "exact" | "flexible" | "unknown";

export const TripType = {
  ONE_DAY:   "ONE_DAY",
  MULTI_DAY: "MULTI_DAY",
  FLEXIBLE:  "FLEXIBLE",
  PICNIC:    "PICNIC",
  DAY_TRIP:  "DAY_TRIP",
  OVERNIGHT: "OVERNIGHT",
  WEEKEND:   "WEEKEND",
} as const;
export type TripType = typeof TripType[keyof typeof TripType];

/**
 * Human-readable label for a tripType value, used in UI.
 */
export const TRIP_TYPE_LABELS: Record<string, string> = {
  ONE_DAY:   "One Day",
  MULTI_DAY: "Multi-Day",
  FLEXIBLE:  "Flexible",
  PICNIC:    "Picnic",
  DAY_TRIP:  "Day Trip",
  OVERNIGHT: "Overnight",
  WEEKEND:   "Weekend Getaway",
};

export const TimeStatus = {
  EXACT:    "EXACT",
  FLEXIBLE: "FLEXIBLE",
  UNKNOWN:  "UNKNOWN",
} as const;
export type TimeStatus = typeof TimeStatus[keyof typeof TimeStatus];

/** True only for trip types that require both a startDate and endDate. */
export function isExactTripDates(trip: {
  dateStatus?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  tripType?: string | null;
}): boolean {
  if (trip.tripType === TripType.FLEXIBLE) return false;
  return (
    trip.dateStatus === "exact" &&
    trip.startDate !== null &&
    (trip.tripType === TripType.ONE_DAY ||
      trip.tripType === TripType.PICNIC ||
      trip.tripType === TripType.DAY_TRIP ||
      trip.tripType === TripType.OVERNIGHT ||
      trip.tripType === TripType.WEEKEND ||
      trip.endDate !== null)
  );
}

export function isFlexibleTripDates(trip: {
  dateStatus?: string | null;
  tripType?: string | null;
}): boolean {
  return trip.dateStatus === "flexible" || trip.tripType === TripType.FLEXIBLE;
}

/**
 * Compute trip duration in days from the trip type + stored dates.
 *
 * Resolution priority (deterministic — never AI):
 *   PICNIC    → 1 day (sub-day outing)
 *   DAY_TRIP  → 1 day
 *   ONE_DAY   → 1 day
 *   OVERNIGHT → 2 days (1 night)
 *   WEEKEND   → 2 days (Sat–Sun)
 *   FLEXIBLE  → defaultDays
 *   MULTI_DAY → derive from startDate/endDate; fallback to defaultDays
 */
export function getTripDuration(
  trip: {
    startDate?: Date | null;
    endDate?: Date | null;
    tripType?: string | null;
  },
  defaultDays: number = 3,
): number {
  switch (trip.tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      return 1;

    case TripType.OVERNIGHT:
    case TripType.WEEKEND:
      return 2;

    case TripType.FLEXIBLE:
      return defaultDays;

    default:
      // MULTI_DAY or legacy unknown — derive from dates
      if (trip.startDate && trip.endDate) {
        return Math.max(
          1,
          Math.ceil(
            (trip.endDate.getTime() - trip.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        );
      }
      return defaultDays;
  }
}

export function formatTripDates(trip: {
  startDate?: Date | null;
  endDate?: Date | null;
  dateStatus?: string | null;
  tripType?: string | null;
}): string {
  switch (trip.tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      if (trip.startDate) return new Date(trip.startDate).toLocaleDateString();
      return TRIP_TYPE_LABELS[trip.tripType ?? ""] || "One Day";

    case TripType.OVERNIGHT:
    case TripType.WEEKEND: {
      if (trip.startDate) {
        const start = new Date(trip.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
      }
      return TRIP_TYPE_LABELS[trip.tripType ?? ""] || "Weekend";
    }

    case TripType.FLEXIBLE:
      return "Flexible Dates";

    default:
      // MULTI_DAY
      if (trip.startDate && trip.endDate) {
        return `${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}`;
      }
      if (trip.dateStatus === "flexible") return "Flexible Dates";
      return "Unknown Dates";
  }
}

export function formatTripStartDate(trip: {
  startDate?: Date | null;
  dateStatus?: string | null;
  tripType?: string | null;
}): string {
  if (trip.startDate) {
    return new Date(trip.startDate).toLocaleDateString();
  }
  if (trip.dateStatus === "flexible" || trip.tripType === TripType.FLEXIBLE) {
    return "Flexible";
  }
  return "Unknown";
}

export function formatTripEndDate(trip: {
  startDate?: Date | null;
  endDate?: Date | null;
  dateStatus?: string | null;
  tripType?: string | null;
}): string {
  switch (trip.tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      if (trip.startDate) return new Date(trip.startDate).toLocaleDateString();
      return "Same day";

    case TripType.OVERNIGHT:
    case TripType.WEEKEND:
      if (trip.startDate) {
        const end = new Date(trip.startDate);
        end.setDate(end.getDate() + 1);
        return end.toLocaleDateString();
      }
      return "Next day";

    case TripType.FLEXIBLE:
      return "Flexible";

    default:
      // MULTI_DAY
      if (trip.endDate) return new Date(trip.endDate).toLocaleDateString();
      if (trip.dateStatus === "flexible") return "Flexible";
      return "Unknown";
  }
}

export function getTripCountdownStatus(trip: {
  startDate?: Date | null;
  endDate?: Date | null;
  dateStatus?: string | null;
  tripType?: string | null;
}): string | null {
  if (trip.dateStatus === "flexible" || trip.tripType === TripType.FLEXIBLE || !trip.startDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(trip.startDate);
  start.setHours(0, 0, 0, 0);

  // Compute end date based on trip type
  let end: Date | null = null;
  switch (trip.tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      end = new Date(trip.startDate);
      break;
    case TripType.OVERNIGHT:
    case TripType.WEEKEND:
      end = new Date(trip.startDate);
      end.setDate(end.getDate() + 1);
      break;
    default:
      end = trip.endDate ? new Date(trip.endDate) : null;
  }

  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return `${diffDays} days to go`;
  } else if (diffDays === 1) {
    return `Starts tomorrow`;
  } else if (diffDays === 0) {
    return `Starts today`;
  } else if (end && today.getTime() <= end.getTime()) {
    return `Trip in progress`;
  } else {
    return `Trip completed`;
  }
}

/**
 * Calculates the exact start and end Date objects for a trip, factoring in
 * startTime and endTime (if provided) and maintaining an elapsed-time model.
 */
export function getTripStartEndDateTimes(trip: {
  startDate?: Date | null;
  endDate?: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  tripType?: string | null;
}): { startDateTime: Date | null; endDateTime: Date | null } {
  if (!trip.startDate) {
    return { startDateTime: null, endDateTime: null };
  }

  const startDateTime = new Date(trip.startDate);
  if (trip.startTime) {
    const [hrs, mins] = trip.startTime.split(":").map(Number);
    startDateTime.setHours(hrs, mins, 0, 0);
  } else {
    startDateTime.setHours(9, 0, 0, 0); // default 9 AM
  }

  let endDateTime = new Date(startDateTime);

  switch (trip.tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      endDateTime = new Date(trip.startDate);
      if (trip.endTime) {
        const [hrs, mins] = trip.endTime.split(":").map(Number);
        endDateTime.setHours(hrs, mins, 0, 0);
      } else {
        endDateTime.setHours(20, 0, 0, 0); // default 8 PM
      }
      break;
    case TripType.OVERNIGHT:
      // Elapsed 24-hour chunk for 1 night
      endDateTime.setHours(startDateTime.getHours() + 24);
      break;
    case TripType.WEEKEND:
      // Elapsed 48-hour chunk for 2 nights (Weekend)
      endDateTime.setHours(startDateTime.getHours() + 48);
      break;
    default:
      if (trip.endDate) {
        endDateTime = new Date(trip.endDate);
        if (trip.endTime) {
          const [hrs, mins] = trip.endTime.split(":").map(Number);
          endDateTime.setHours(hrs, mins, 0, 0);
        } else {
          endDateTime.setHours(20, 0, 0, 0);
        }
      } else {
        // Fallback for MULTI_DAY with no end date
        endDateTime.setHours(startDateTime.getHours() + 48);
      }
      break;
  }

  return { startDateTime, endDateTime };
}
