"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveDestination } from "@/lib/destination-resolver";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TripType, deriveTripTypeFromDates } from "@/lib/date-utils";

export type TripState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Compute the effective endDate server-side for trip types that derive it
 * from startDate rather than accepting it from the client.
 *
 * Architecture rule: Client never provides computed dates — server owns this.
 */
function computeEndDate(tripType: string, startDate: Date): Date | null {
  switch (tripType) {
    case TripType.PICNIC:
    case TripType.DAY_TRIP:
    case TripType.ONE_DAY:
      return new Date(startDate); // same-day

    case TripType.OVERNIGHT:
    case TripType.WEEKEND: {
      const end = new Date(startDate);
      end.setDate(end.getDate() + 1); // +1 night
      return end;
    }

    default:
      return null; // MULTI_DAY: caller provides
  }
}

export async function createTrip(
  _prevState: TripState,
  formData: FormData,
): Promise<TripState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be logged in" };
  }

  const title = (formData.get("title") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const budgetStr = formData.get("budget") as string;
  const maxTravelersStr = formData.get("maxTravelers") as string;
  const paceLevel = formData.get("paceLevel") as string;
  const dateStatus = (formData.get("dateStatus") as string) || "unknown";
  const timeStatus = (formData.get("timeStatus") as string) || "UNKNOWN";
  const startTime = (formData.get("startTime") as string) || null;
  const endTime = (formData.get("endTime") as string) || null;
  const travelSegmentsStr = formData.get("travelSegments") as string;
  const accommodationsStr = formData.get("accommodations") as string;
  const accessibilityNotes = ((formData.get("accessibilityNotes") as string) ?? "").trim();
  const preferencesStr = formData.get("preferences") as string;
  const waypointsStr = formData.get("waypoints") as string;
  const isRoundTrip = formData.get("isRoundTrip") === "true";
  const returnDestination = (formData.get("returnDestination") as string) || null;
  const travelerCompositionStr = formData.get("travelerComposition") as string;

  let parsedPreferences: { category: string; priority: string }[] = [];
  try {
    if (preferencesStr) parsedPreferences = JSON.parse(preferencesStr);
  } catch (err) {
    console.error("Failed to parse preferences", err);
  }

  // Validate waypoints JSON
  let waypointsJson: string | null = null;
  try {
    if (waypointsStr) {
      const parsed = JSON.parse(waypointsStr);
      if (Array.isArray(parsed)) waypointsJson = JSON.stringify(parsed);
    }
  } catch {
    // ignore invalid waypoints
  }

  // Validate travelerComposition JSON
  let travelerCompositionJson: string | null = null;
  try {
    if (travelerCompositionStr) {
      const parsed = JSON.parse(travelerCompositionStr);
      travelerCompositionJson = JSON.stringify(parsed);
    }
  } catch {
    // ignore
  }


  const fieldErrors: Record<string, string> = {};

  if (!title) fieldErrors.title = "Trip title is required";
  if (!destination) fieldErrors.destination = "Destination is required";
  if (!budgetStr) fieldErrors.budget = "Budget is required";
  if (!startDateStr) fieldErrors.startDate = "Start date is required";
  if (!endDateStr) fieldErrors.endDate = "End date is required";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Parse and validate values
  const budgetInr = parseInt(budgetStr, 10);
  const maxTravelers = parseInt(maxTravelersStr || "20", 10);

  if (isNaN(budgetInr) || budgetInr <= 0)
    fieldErrors.budget = "Budget must be a positive number";
  if (maxTravelers < 1 || maxTravelers > 20)
    fieldErrors.maxTravelers = "Travelers must be between 1 and 20";
  if (!["easy", "balanced", "full"].includes(paceLevel))
    fieldErrors.paceLevel = "Invalid pace level";

  // Parse dates only if provided
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (startDateStr) {
    startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      fieldErrors.startDate = "Invalid start date";
    }
  }

  if (endDateStr) {
    endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) {
      fieldErrors.endDate = "Invalid end date";
    } else if (startDate && endDate < startDate) {
      fieldErrors.endDate = "End date must be on or after start date";
    } else if (startDate && endDate) {
      const dayCount =
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayCount > 30) fieldErrors.endDate = "Trip cannot exceed 30 days";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const derivedTripType: string =
    startDate && endDate ? deriveTripTypeFromDates(startDate, endDate) : TripType.MULTI_DAY;

  const matchedDestination = await resolveDestination(destination);

  const trip = await prisma.trip.create({
    data: {
      title,
      destination,
      startDate,
      endDate,
      budgetInr,
      maxTravelers,
      paceLevel,
      tripType: derivedTripType,
      dateStatus,
      timeStatus,
      startTime,
      endTime,
      waypoints: waypointsJson,
      isRoundTrip,
      returnDestination,
      travelerComposition: travelerCompositionJson,
      status: "draft",
      creatorId: session.user.id,
      destinationId: matchedDestination?.id ?? null,
      travelSegments: travelSegmentsStr ? {
        create: (() => {
          try {
            const parsed = JSON.parse(travelSegmentsStr);
            if (Array.isArray(parsed)) {
              type Segment = { type: string; mode: string; originName: string | null; destinationName: string | null };
              return parsed.reduce((acc: Segment[], seg: unknown) => {
                if (typeof seg === 'object' && seg !== null) {
                  const s = seg as Record<string, unknown>;
                  acc.push({
                    type: "transit",
                    mode: typeof s.mode === 'string' ? s.mode : "unknown",
                    originName: typeof s.origin === 'string' ? s.origin : null,
                    destinationName: typeof s.destination === 'string' ? s.destination : null,
                  });
                }
                return acc;
              }, [] as Segment[]);
            }
          } catch (err) {
            // ignore
          }
          return [];
        })()
      } : undefined,
      groupMembers: {
        create: {
          userId: session.user.id,
          role: "creator",
          accessibilityNotes,
          travelerPreferences:
            parsedPreferences.length > 0
              ? {
                  create: parsedPreferences.map((p) => ({
                    category: p.category,
                    priority: p.priority,
                  })),
                }
              : undefined,
        },
      },
    },
  });

  if (formData.get("autoGenerate") === "true") {
    const { generateTripItinerary } = await import("./itinerary");
    const generation = await generateTripItinerary(trip.id);
    // The trip is saved either way; say why the itinerary didn't start (this used to be
    // swallowed, leaving an empty itinerary page with no explanation)
    redirect(
      generation.success
        ? `/trips/${trip.id}/itinerary`
        : `/trips/${trip.id}/itinerary?generation=${generation.errorType}`,
    );
  }

  redirect(`/trips/${trip.id}`);
}

export async function updateAccessibilityNotes(tripId: string, notes: string): Promise<TripState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be logged in" };
  }

  try {
    await prisma.groupMember.updateMany({
      where: { tripId, userId: session.user.id },
      data: { accessibilityNotes: notes }
    });
    return {};
  } catch (err) {
    return { error: "Failed to update accessibility notes" };
  }
}

export async function deleteTrip(tripId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be logged in" };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { creatorId: true },
  });

  if (!trip) {
    return { error: "Trip not found" };
  }

  if (trip.creatorId !== session.user.id) {
    return { error: "Only the trip creator can delete this trip" };
  }

  try {
    await prisma.trip.delete({ where: { id: tripId } });
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to delete trip" };
  }
}
