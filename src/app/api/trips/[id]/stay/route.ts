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
  const name = optionalText(body?.name);
  const location = optionalText(body?.location);
  if (!name || location === undefined) {
    return NextResponse.json({ error: "A stay name (max 200 characters) is required" }, { status: 400 });
  }

  await prisma.tripAccommodation.create({
    data: {
      tripId: id,
      name,
      location,
    }
  });

  return NextResponse.json({ success: true });
}
