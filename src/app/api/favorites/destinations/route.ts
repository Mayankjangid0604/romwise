import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const toggleSchema = z.object({
  destinationId: z.string(),
  isFavorite: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = toggleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { destinationId, isFavorite } = result.data;

    // Check if destination exists
    const dest = await prisma.travelDestination.findUnique({ where: { id: destinationId } });
    if (!dest) {
      return NextResponse.json({ error: "Destination not found" }, { status: 404 });
    }

    if (isFavorite) {
      await prisma.favoriteDestination.upsert({
        where: {
          userId_destinationId: {
            userId: session.user.id,
            destinationId,
          }
        },
        update: {},
        create: {
          id: crypto.randomUUID(),
          userId: session.user.id,
          destinationId,
        }
      });
    } else {
      await prisma.favoriteDestination.deleteMany({
        where: {
          userId: session.user.id,
          destinationId,
        }
      });
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
