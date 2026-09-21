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
  const { amountInr, description, category, payerId, date, participants } = await req.json();

  if (!amountInr || !description || !participants || !Array.isArray(participants) || participants.length === 0) {
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
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          tripId: id,
          payerId: payerId || session.user!.id,
          amountInr: parseInt(amountInr, 10),
          description,
          category: category || "other",
          date: date ? new Date(date) : new Date(),
        },
      });

      const participantData = participants.map((p: { userId: string; owedInr: number }) => ({
        expenseId: exp.id,
        userId: p.userId,
        owedInr: Math.round(p.owedInr),
      }));

      await tx.expenseParticipant.createMany({
        data: participantData,
      });

      return tx.expense.findUnique({
        where: { id: exp.id },
        include: { payer: true, ExpenseParticipant: true },
      });
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to add expense", error);
    return NextResponse.json({ error: "Failed to add expense" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const { searchParams } = new URL(req.url);
  const expenseId = searchParams.get("expenseId");

  if (!expenseId) {
    return NextResponse.json({ error: "Missing expenseId" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { groupMembers: true },
  });

  if (!trip || !trip.groupMembers.some((m) => m.userId === session.user!.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense || expense.tripId !== id) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  try {
    await prisma.expense.delete({
      where: { id: expenseId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
