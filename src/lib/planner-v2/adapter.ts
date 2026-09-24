import { generateItineraryV2 } from "./engine";
import { resolveDestination } from "../destination-resolver";
import { getTripDuration, TripType, getTripStartEndDateTimes } from "../date-utils";
import type { TripBrainInput } from "../trip-brain";
import { DestinationNotFoundError, DestinationDataError } from "../trip-brain";

export async function generateGroundedItineraryV2(input: TripBrainInput) {
  const resolved = await resolveDestination(input.destination);
  if (!resolved) {
    throw new DestinationNotFoundError(input.destination);
  }

  // Define how many days
  const startEnd = getTripStartEndDateTimes({
    tripType: input.tripType,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime
  });
  
  let numDays = getTripDuration({ 
    startDate: startEnd.startDateTime, 
    endDate: startEnd.endDateTime,
    tripType: input.tripType
  });
  if (numDays === 0) numDays = 1;

  const result = await generateItineraryV2(
    {
      destinationId: resolved.id,
      allPreferences: input.allPreferences,
      budgetPerDayInr: input.budgetInr,
      accessibilityRequirement: "none", // Simplification
      limit: 100 // V2 can handle more candidates deterministically
    },
    numDays,
    input.paceLevel,
    startEnd.startDateTime ?? new Date()
  );

  if (result.days.length === 0 || result.days[0].items.length === 0) {
    throw new DestinationDataError(resolved.name);
  }

  return {
    days: result.days,
    metrics: result.metrics,
    resolvedDestination: resolved,
    usedGemini: false,
    usedFallback: false, // V2 is the deterministic engine itself
    candidateCount: result.metrics.candidateCount,
    season: "unknown"
  };
}
