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

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const currentUserMember = trip.groupMembers.find((m) => m.userId === session.user!.id);
  const isCreator = trip.creatorId === session.user!.id;

  if (!currentUserMember && !isCreator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role Security: Only creator or members can create expenses
  if (!isCreator && currentUserMember?.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot create expenses" }, { status: 403 });
  }

  const groupUserIds = new Set(trip.groupMembers.map((m) => m.userId));
  if (isCreator) groupUserIds.add(trip.creatorId);

  const finalPayerId = payerId || session.user!.id;
  if (!groupUserIds.has(finalPayerId)) {
    return NextResponse.json({ error: "Payer is not a trip participant" }, { status: 400 });
  }

  let totalOwed = 0;
  for (const p of participants) {
    if (!groupUserIds.has(p.userId)) {
      return NextResponse.json({ error: `User ${p.userId} is not a participant` }, { status: 400 });
    }
    totalOwed += Math.round(p.owedInr);
  }

  const parsedAmount = parseInt(amountInr, 10);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!Number.isFinite(totalOwed)) {
    return NextResponse.json({ error: "Invalid split amounts" }, { status: 400 });
  }
  // Allow ±1 rounding tolerance to handle non-divisible splits (e.g. ₹100 ÷ 3)
  if (Math.abs(totalOwed - parsedAmount) > 1) {
    return NextResponse.json({ error: `Sum of split amounts (${totalOwed}) does not match total amount (${parsedAmount})` }, { status: 400 });
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

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const currentUserMember = trip.groupMembers.find((m) => m.userId === session.user!.id);
  const isCreator = trip.creatorId === session.user!.id;

  if (!currentUserMember && !isCreator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense || expense.tripId !== id) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const isPayer = expense.payerId === session.user!.id;

  // Viewers cannot delete
  if (!isCreator && currentUserMember?.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot delete expenses" }, { status: 403 });
  }

  // Only the creator or the payer can delete
  if (!isCreator && !isPayer) {
    return NextResponse.json({ error: "Only the creator or payer can delete this expense" }, { status: 403 });
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
