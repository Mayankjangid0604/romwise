import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchDestinations } from "@/lib/destinations";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ destinations: [] });
  }

  const destinations = await searchDestinations(q, 8);

  return NextResponse.json({
    destinations: destinations.map((d) => ({
      id: d.id,
      name: d.name,
      state: d.state,
      lat: d.lat,
      lng: d.lng,
    })),
  });
}
