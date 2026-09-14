"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateGroundedItinerary,
  DestinationNotFoundError,
  DestinationDataError,
  ValidationError,
} from "@/lib/trip-brain";
import { checkGenerationEntitlement } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";

export type ItineraryGenerationResult =
  | { success: true; usedGemini: boolean; candidateCount: number }
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
    },
  });

  if (!trip) {
    return { success: false, error: "Trip not found", errorType: "unknown" };
  }

  const isMember = trip.groupMembers.some((m) => m.userId === session.user!.id);
  if (!isMember) {
    return { success: false, error: "Not a member of this trip", errorType: "auth" };
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

  const creatorMember = trip.groupMembers.find((m) => m.role === "creator");

  // Run the grounded pipeline — do NOT increment tripGenerations here
  let result: Awaited<ReturnType<typeof generateGroundedItinerary>>;
  try {
    result = await generateGroundedItinerary({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      budgetInr: trip.budgetInr,
      paceLevel: trip.paceLevel as "easy" | "balanced" | "full",
      allPreferences,
      accessibilityNotes: creatorMember?.accessibilityNotes || undefined,
    });
  } catch (err) {
    if (err instanceof DestinationNotFoundError) {
      return { success: false, error: err.message, errorType: "destination_not_found" };
    }
    if (err instanceof DestinationDataError) {
      return { success: false, error: err.message, errorType: "no_place_data" };
    }
    if (err instanceof ValidationError) {
      return { success: false, error: err.message, errorType: "validation" };
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg, errorType: "unknown" };
  }

  // Generation succeeded — now persist and consume the credit
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
            reasoning: item.reasoning,
            order: item.order,
            placeId: item.placeId ?? null,
          })),
        },
      },
    });
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: "planning",
      // Update destinationId if the resolver found a better match
      destinationId: result.resolvedDestination.id,
    },
  });

  // Only increment AFTER successful persistence
  await prisma.user.update({
    where: { id: session.user.id },
    data: { tripGenerations: { increment: 1 } },
  });

  revalidatePath(`/trips/${tripId}`);

  return {
    success: true,
    usedGemini: result.usedGemini,
    candidateCount: result.candidateCount,
  };
}
