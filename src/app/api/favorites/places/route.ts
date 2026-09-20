import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const toggleSchema = z.object({
  placeId: z.string(),
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

    const { placeId, isFavorite } = result.data;

    // Check if place exists
    const place = await prisma.place.findUnique({ where: { id: placeId } });
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (isFavorite) {
      await prisma.favoritePlace.upsert({
        where: {
          userId_placeId: {
            userId: session.user.id,
            placeId,
          }
        },
        update: {},
        create: {
          userId: session.user.id,
          placeId,
        }
      });
    } else {
      await prisma.favoritePlace.deleteMany({
        where: {
          userId: session.user.id,
          placeId,
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
