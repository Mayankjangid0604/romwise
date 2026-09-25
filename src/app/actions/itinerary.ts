"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  generateGroundedItinerary,
  DestinationNotFoundError,
  DestinationDataError,
  ValidationError,
} from "@/lib/trip-brain";
import { generateGroundedItineraryV2 } from "@/lib/planner-v2/adapter";
import { checkGenerationEntitlement } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

export type ItineraryGenerationResult =
  | { success: true; usedGemini: boolean; usedFallback: boolean; candidateCount: number; season: string }
  | { success: false; error: string; errorType: "destination_not_found" | "no_place_data" | "validation" | "entitlement" | "auth" | "unknown" };

export async function generateTripItinerary(tripId: string): Promise<ItineraryGenerationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized", errorType: "auth" };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      groupMembers: {
        include: { travelerPreferences: true },
      },
      tripPlaceSelections: true,
    },
  });

  if (!trip) {
    return { success: false, error: "Trip not found", errorType: "unknown" };
  }

  const isMember = trip.groupMembers.some((m) => m.userId === session.user!.id);
  if (!isMember) {
    return { success: false, error: "Not a member of this trip", errorType: "auth" };
  }

  if (trip.status === "generating") {
    return { success: false, error: "Generation is already in progress.", errorType: "unknown" };
  }

  // Check entitlement BEFORE attempting generation — but only consume credit on success
  const entitlement = await checkGenerationEntitlement(session.user.id);
  if (!entitlement.canGenerate) {
    return {
      success: false,
      error: entitlement.reason ?? "Generation limit reached",
      errorType: "entitlement",
    };
  }

  // Aggregate preferences from all group members
  const allPreferences = trip.groupMembers.flatMap((m) => {
    if (m.travelerPreferences.length > 0) {
      return m.travelerPreferences.map((p) => ({
        category: p.category,
        priority: p.priority as "must-have" | "very-important" | "preferred" | "nice-to-have" | "avoid" | "never",
      }));
    }
    // Backward-compatible: fall back to legacy JSON string field
    try {
      return JSON.parse(m.preferences) as { category: string; priority: "must-have" | "very-important" | "preferred" | "nice-to-have" | "avoid" | "never" }[];
    } catch {
      return [];
    }
  });

  // Generation is starting - update status
  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "generating" },
  });

  const userId = session.user.id;

  // Run generation in background via after() — inline, no fetch needed
  after(async () => {
    try {
      const creatorMember = trip.groupMembers.find((m) => m.role === "creator");

      // Parse waypoints JSON stored in DB
      let parsedWaypoints: string[] | undefined;
      if (trip.waypoints) {
        try {
          const parsed = JSON.parse(trip.waypoints);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedWaypoints = parsed.filter((w): w is string => typeof w === "string");
          }
        } catch {
          // ignore malformed waypoints
        }
      }

      const inputPayload = {
        destination: trip.destination,
        waypoints: parsedWaypoints,
        startDate: trip.startDate,
        endDate: trip.endDate,
        dateStatus: trip.dateStatus,
        tripType: trip.tripType || "MULTI_DAY",
        timeStatus: trip.timeStatus || "UNKNOWN",
        startTime: trip.startTime || null,
        endTime: trip.endTime || null,
        budgetInr: trip.budgetInr,
        maxTravelers: trip.maxTravelers,
        paceLevel: (trip.paceLevel as "easy" | "balanced" | "full") || "balanced",
        allPreferences,
        accessibilityNotes: creatorMember?.accessibilityNotes || undefined,
        placeSelections: trip.tripPlaceSelections,
      };

      // V2 is the default deterministic engine. V1 (Gemini) only used if explicitly requested.
      const result = process.env.PLANNER_ENGINE === "v1" 
        ? await generateGroundedItinerary(inputPayload)
        : await generateGroundedItineraryV2(inputPayload);

      // Lifecycle guard: check if trip was deleted during background generation
      const currentTrip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
      if (!currentTrip) {
        console.log(`[Itinerary] Trip ${tripId} was deleted during generation. Aborting.`);
        return;
      }

      // Save itinerary to DB
      await prisma.itineraryDay.deleteMany({ where: { tripId } });

      for (const day of result.days) {
        await prisma.itineraryDay.create({
          data: {
            dayNumber: day.dayNumber,
            date: day.date,
            tripId,
            items: {
              create: day.items.map((item) => ({
                title: item.title,
                description: item.description,
                category: item.category,
                startTime: item.startTime,
                endTime: item.endTime,
                estimatedCostInr: item.estimatedCostInr,
                costSource: item.costSource,
                reasoning: item.reasoning,
                order: item.order,
                placeId: item.placeId ?? null,
              })),
            },
          },
        });
      }

      // Mark trip as planning and link destination
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: "planning",
          destinationId: result.resolvedDestination.id,
          unscheduledPlaces: result.unscheduledMustVisits && result.unscheduledMustVisits.length > 0
            ? (result.unscheduledMustVisits as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });

      // Consume entitlement credit
      await prisma.user.update({
        where: { id: userId },
        data: { tripGenerations: { increment: 1 } },
      });

      console.log(`[Itinerary] Generation completed for trip ${tripId}`);
    } catch (err: unknown) {
      // If the error is simply because the trip was deleted, ignore it
      const errObj = err as { code?: string };
      if (errObj?.code === "P2003" || errObj?.code === "P2025") {
         console.log(`[Itinerary] Trip ${tripId} deleted during generation. Aborting safely.`);
         return;
      }

      console.error(`[Itinerary] Generation failed for trip ${tripId}:`, err);
      // Always reset trip status so it doesn't get stuck on "generating"
      try {
        await prisma.trip.update({
          where: { id: tripId },
          data: { status: "draft" },
        });
      } catch (resetErr: unknown) {
        if ((resetErr as { code?: string })?.code !== "P2025") {
          console.error("[Itinerary] Failed to reset trip status:", resetErr);
        }
      }
    }
  });

  revalidatePath(`/trips/${tripId}`);

  return {
    success: true,
    usedGemini: process.env.PLANNER_ENGINE === "v1",
    usedFallback: false,
    candidateCount: 0,
    season: "",
  };
}

// ── Manual item editing ───────────────────────────────────────────────────────

export type ItemEditInput = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  estimatedCostInr: number | null;
};

export type ItemEditResult =
  | { success: true }
  | { success: false; error: string };

export async function updateItineraryItem(
  tripId: string,
  itemId: string,
  input: ItemEditInput,
): Promise<ItemEditResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify the item belongs to this trip (security check)
  const item = await prisma.itineraryItem.findUnique({
    where: { id: itemId },
    include: { itineraryDay: true },
  });

  if (!item || item.itineraryDay.tripId !== tripId) {
    return { success: false, error: "Item not found" };
  }

  // Verify user is a member of the trip
  const member = await prisma.groupMember.findFirst({
    where: { tripId, userId: session.user.id },
  });
  if (!member) {
    return { success: false, error: "Not a member of this trip" };
  }
  if (member.role === "viewer") {
    return { success: false, error: "Viewers cannot edit itinerary" };
  }

  if (!input.title.trim()) return { success: false, error: "Title is required" };
  if (!input.startTime.trim()) return { success: false, error: "Start time is required" };
  if (!input.endTime.trim()) return { success: false, error: "End time is required" };

  await prisma.itineraryItem.update({
    where: { id: itemId },
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      startTime: input.startTime.trim(),
      endTime: input.endTime.trim(),
      estimatedCostInr: input.estimatedCostInr,
    },
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteItineraryItem(tripId: string, itemId: string): Promise<ItemEditResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const member = await prisma.groupMember.findFirst({
    where: { tripId, userId: session.user.id },
  });
  if (!member) return { success: false, error: "Not a member" };
  if (member.role === "viewer") return { success: false, error: "Viewers cannot edit itinerary" };

  // Verify item belongs to this trip (prevents IDOR)
  const item = await prisma.itineraryItem.findUnique({
    where: { id: itemId },
    include: { itineraryDay: { select: { tripId: true } } },
  });
  if (!item || item.itineraryDay.tripId !== tripId) {
    return { success: false, error: "Item not found in this trip" };
  }

  await prisma.itineraryItem.delete({
    where: { id: itemId },
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function addItineraryItem(tripId: string, dayId: string): Promise<ItemEditResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const member = await prisma.groupMember.findFirst({
    where: { tripId, userId: session.user.id },
  });
  if (!member) return { success: false, error: "Not a member" };
  if (member.role === "viewer") return { success: false, error: "Viewers cannot edit itinerary" };

  // Verify day belongs to this trip (prevents cross-trip injection)
  const day = await prisma.itineraryDay.findUnique({
    where: { id: dayId },
    select: { tripId: true },
  });
  if (!day || day.tripId !== tripId) {
    return { success: false, error: "Day not found in this trip" };
  }

  await prisma.itineraryItem.create({
    data: {
      itineraryDayId: dayId,
      title: "New Activity",
      description: "Click to edit",
      category: "activity",
      startTime: "12:00",
      endTime: "13:00",
      costSource: "unknown",
      reasoning: "Manually added",
      order: 999, // Will be sorted to the end
    },
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

