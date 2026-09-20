import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  if (!trip || !trip.groupMembers.some(m => m.userId === session.user!.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  await prisma.tripAccommodation.create({
    data: {
      tripId: id,
      name: body.name,
      location: body.location,
    }
  });

  return NextResponse.json({ success: true });
}
