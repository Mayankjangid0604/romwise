import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const recentSchema = z.object({
  type: z.enum(["VIEW_TRIP", "VIEW_DESTINATION"]),
  tripId: z.string().optional(),
  destinationId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = recentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { type, tripId, destinationId } = result.data;

    // We keep only the most recent 20 activities per user. Let's do a simple insert and we can prune occasionally.
    // To avoid creating a new record on every single page load for the SAME item in the same hour,
    // we could try to update an existing recent one. But for now, simple upsert or create works.
    
    // Check if we already have this exact activity type+id
    const existing = await prisma.recentActivity.findFirst({
      where: {
        userId: session.user.id,
        type,
        ...(tripId && { tripId }),
        ...(destinationId && { destinationId }),
      },
      orderBy: { viewedAt: 'desc' }
    });

    if (existing) {
      try {
        await prisma.recentActivity.update({
          where: { id: existing.id },
          data: { viewedAt: new Date() }
        });
      } catch (updateErr: unknown) {
        // P2025 = record to update not found (deleted during concurrent test cleanup) — safe to ignore
        if (
          typeof updateErr === "object" &&
          updateErr !== null &&
          (updateErr as { code?: string }).code !== "P2025"
        ) {
          throw updateErr;
        }
      }
    } else {
      // Guard against the race condition where session.user.id is valid in the JWT
      // but the user record was deleted (e.g. during E2E test afterEach cleanup)
      // between session validation above and this write. P2003 = FK violation.
      try {
        // Verify user still exists — cheap SELECT before the INSERT
        const userExists = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true },
        });
        if (!userExists) {
          // User was deleted; silently succeed — there is nowhere to log activity
          return NextResponse.json({ success: true });
        }
        await prisma.recentActivity.create({
          data: {
            userId: session.user.id,
            type,
            tripId,
            destinationId,
          },
        });
      } catch (createErr: unknown) {
        // P2003 = FK constraint violation (user deleted in a race between our check above and the insert)
        if (
          typeof createErr === "object" &&
          createErr !== null &&
          (createErr as { code?: string }).code === "P2003"
        ) {
          // Race condition during test cleanup — safe to ignore
          return NextResponse.json({ success: true });
        }
        throw createErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
