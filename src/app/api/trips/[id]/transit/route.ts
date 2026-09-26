import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditTrip, roleIn } from "@/lib/security";

function optionalText(value: unknown, max = 200): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : undefined;
}

const TRANSIT_MODES = new Set(["FLIGHT", "TRAIN", "BUS", "CAR", "FERRY", "OTHER"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify membership
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { groupMembers: true }
  });

  const role = trip ? roleIn(trip.groupMembers, session.user.id) : null;
  if (!trip || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!canEditTrip(role)) {
    return NextResponse.json({ error: "Viewers cannot modify this trip" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const originName = optionalText(body?.originName);
  const destinationName = optionalText(body?.destinationName);
  const mode = typeof body?.mode === "string" ? body.mode.toUpperCase() : "FLIGHT";
  if (originName === undefined || destinationName === undefined || !TRANSIT_MODES.has(mode)) {
    return NextResponse.json({ error: "Invalid transit details" }, { status: 400 });
  }

  await prisma.travelSegment.create({
    data: {
      tripId: id,
      type: "TRANSIT",
      originName,
      destinationName,
      mode,
    }
  });

  return NextResponse.json({ success: true });
}
