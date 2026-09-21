import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  const share = await prisma.tripShare.findUnique({
    where: { token, active: true },
  });

  if (!share) {
    return new NextResponse("Invalid or expired invite link.", { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login, then back to the join route
    const callbackUrl = encodeURIComponent(`/trips/join/${token}`);
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: share.tripId },
  });

  if (!trip) {
    return new NextResponse("Trip not found.", { status: 404 });
  }

  if (trip.creatorId === session.user.id) {
    // Creator is already in the trip
    redirect(`/trips/${share.tripId}`);
  }

  // Check if they are already a member
  const existingMember = await prisma.groupMember.findUnique({
    where: {
      userId_tripId: {
        userId: session.user.id,
        tripId: share.tripId,
      },
    },
  });

  if (existingMember) {
    // If they already exist, but the invite link offers a higher role, we could upgrade it.
    // For simplicity, just redirect them to the trip.
    redirect(`/trips/${share.tripId}`);
  }

  // Add the user to the group
  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      tripId: share.tripId,
      role: share.role,
    },
  });

  redirect(`/trips/${share.tripId}`);
}
