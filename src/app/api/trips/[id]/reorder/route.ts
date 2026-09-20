import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const { dayId, items } = await req.json();

  if (!dayId || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { groupMembers: true },
  });

  if (!trip || !trip.groupMembers.some((m) => m.userId === session.user!.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update order using a transaction
  try {
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.itineraryItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder items", error);
    return NextResponse.json({ error: "Failed to reorder items" }, { status: 500 });
  }
}
