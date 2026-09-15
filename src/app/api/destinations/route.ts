import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTravelDestinations } from "@/lib/destination-resolver";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ destinations: [] });
  }

  const destinations = await searchTravelDestinations(q, 8);

  return NextResponse.json({
    destinations: destinations.map((d: { id: string; name: string; state: string; lat: number; lng: number }) => ({
      id: d.id,
      name: d.name,
      state: d.state,
      lat: d.lat,
      lng: d.lng,
    })),
  });
}
