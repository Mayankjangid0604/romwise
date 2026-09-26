import { NextResponse } from "next/server";
import { weatherProvider } from "@/lib/providers/weather";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  // Only used by trip pages; don't run an open, unauthenticated proxy to the weather API
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!lat || !lng || !start || !end) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const forecast = await weatherProvider.getForecast(
      lat,
      lng,
      new Date(start),
      new Date(end)
    );
    return NextResponse.json(forecast);
  } catch (err) {
    console.error("Failed to fetch weather:", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
