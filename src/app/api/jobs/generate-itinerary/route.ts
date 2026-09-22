import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateGroundedItinerary,
  DestinationNotFoundError,
  DestinationDataError,
  ValidationError,
} from "@/lib/trip-brain";

export const maxDuration = 60; // Allow up to 60s for Vercel Pro

export async function POST(req: Request) {
  let tripId: string | undefined;
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.INTERNAL_JOB_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    tripId = body.tripId;
    const userId: string | undefined = body.userId;

    if (!tripId || !userId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Narrow types after validation
    const validTripId: string = tripId;
    const validUserId: string = userId;

    const trip = await prisma.trip.findUnique({
      where: { id: validTripId },
      include: {
        groupMembers: {
          include: { travelerPreferences: true },
        },
      },
    });

    if (!trip || trip.status !== "generating") {
      return NextResponse.json({ error: "Invalid trip state" }, { status: 400 });
    }

    const allPreferences = trip.groupMembers.flatMap((m) => {
      if (m.travelerPreferences.length > 0) {
        return m.travelerPreferences.map((p) => ({
          category: p.category,
          priority: p.priority as "must-have" | "very-important" | "preferred" | "nice-to-have" | "avoid" | "never",
        }));
      }
      try {
        return JSON.parse(m.preferences);
      } catch {
        return [];
      }
    });

    const creatorMember = trip.groupMembers.find((m) => m.role === "creator");

    // Parse waypoints JSON stored in DB (e.g. '["Gulmarg","Pahalgam"]')
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

    let result;
    try {
      result = await generateGroundedItinerary({
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
        paceLevel: trip.paceLevel as "easy" | "balanced" | "full",
        allPreferences,
        accessibilityNotes: creatorMember?.accessibilityNotes || undefined,
      });

    } catch (err) {
      console.error("Trip Brain error:", err);
      // Revert status to draft on error
      await prisma.trip.update({ where: { id: validTripId }, data: { status: "draft" } });
      return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }

    await prisma.itineraryDay.deleteMany({ where: { tripId: validTripId } });

    for (const day of result.days) {
      await prisma.itineraryDay.create({
        data: {
          dayNumber: day.dayNumber,
          date: day.date,
          tripId: validTripId,
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

    await prisma.trip.update({
      where: { id: validTripId },
      data: {
        status: "planning",
        destinationId: result.resolvedDestination.id,
      },
    });

    // Consume entitlement credit
    await prisma.user.update({
      where: { id: validUserId },
      data: { tripGenerations: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Background job error:", err);
    // Ensure the trip is never left permanently stuck in "generating" state.
    if (tripId) {
      try {
        await prisma.trip.update({ where: { id: tripId }, data: { status: "draft" } });
      } catch (resetErr) {
        console.error("Failed to reset trip status after background job error:", resetErr);
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
