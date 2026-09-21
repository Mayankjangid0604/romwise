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

  // Generation is starting - update status and fire background job
  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "generating" },
  });

  const baseUrl = process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!baseUrl) {
    throw new Error("APP_URL must be defined in production.");
  }
  
  // Fire and forget background job
  after(() => {
    fetch(`${baseUrl}/api/jobs/generate-itinerary`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_JOB_SECRET}`
      },
      body: JSON.stringify({ tripId, userId: session.user?.id }),
    }).catch((err) => console.error("Failed to start background job:", err));
  });

  revalidatePath(`/trips/${tripId}`);

  return {
    success: true,
    usedGemini: true,
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
