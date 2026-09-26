import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scoped to trips the caller belongs to (any logged-in user could read any trip's status)
    const trip = await prisma.trip.findFirst({
      where: { id, groupMembers: { some: { userId: session.user.id } } },
      select: { status: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ status: trip.status });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
