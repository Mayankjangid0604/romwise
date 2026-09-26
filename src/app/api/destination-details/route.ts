import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDestinationDetails } from "@/lib/destination-brain";

// Simple in-memory cache for DB query results
const detailsCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — DB data doesn't change often

function getCached(key: string): unknown | null {
  const entry = detailsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    detailsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  if (detailsCache.size > 100) {
    const oldestKey = detailsCache.keys().next().value;
    if (oldestKey) detailsCache.delete(oldestKey);
  }
  detailsCache.set(key, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name query param is required" }, { status: 400 });
  }

  const cleanName = name.trim().slice(0, 100);
  if (cleanName.length === 0) {
    return NextResponse.json({ error: "name must not be blank" }, { status: 400 });
  }

  const cacheKey = cleanName.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const details = await getDestinationDetails(cleanName);
    setCache(cacheKey, details);
    return NextResponse.json(details);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[destination-details] Error:", message);
    // Only the known not-found case is user-facing; anything else (e.g. a Prisma error)
    // stays in the server log instead of being echoed to the client.
    if (message === "Destination not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load destination details" }, { status: 500 });
  }
}
