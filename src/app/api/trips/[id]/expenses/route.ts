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
  const { amountInr, description, category } = await req.json();

  if (!amountInr || !description) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { groupMembers: true },
  });

  if (!trip || !trip.groupMembers.some((m) => m.userId === session.user!.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        tripId: id,
        payerId: session.user.id,
        amountInr: parseInt(amountInr, 10),
        description,
        category: category || "other",
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to add expense", error);
    return NextResponse.json({ error: "Failed to add expense" }, { status: 500 });
  }
}
