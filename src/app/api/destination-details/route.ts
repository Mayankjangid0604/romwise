import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDestinationDetails } from "@/lib/discovery";
import { checkRateLimitDb } from "@/lib/db-rate-limit";
import { headers } from "next/headers";
import { AIGatewayError } from "@/lib/ai/types";

// In-memory cache for destination details to avoid hammering the AI API
// with repeated requests for the same destination
const detailsCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  // Evict oldest entries if cache grows too large
  if (detailsCache.size > 50) {
    const oldestKey = detailsCache.keys().next().value;
    if (oldestKey) detailsCache.delete(oldestKey);
  }
  detailsCache.set(key, { data, timestamp: Date.now() });
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  // SEC-004: Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name query param is required" }, { status: 400 });
  }

  // B-006: Sanitize and length-check input
  const cleanName = name.trim().slice(0, 100);
  if (cleanName.length === 0) {
    return NextResponse.json({ error: "name must not be blank" }, { status: 400 });
  }

  // Check cache first — avoids both rate limiting and AI calls for repeated requests
  const cacheKey = cleanName.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // SEC-001: Rate limit per user (5 requests / 15 minutes)
  const ip = await getClientIp();
  const rateLimitKey = `destination-details:${session.user.id}:${ip}`;
  const { allowed, retryAfterSeconds } = await checkRateLimitDb(rateLimitKey);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  const context = request.nextUrl.searchParams.get("context") || undefined;

  try {
    const details = await getDestinationDetails(cleanName, context);
    // Cache successful result
    setCache(cacheKey, details);
    return NextResponse.json(details);
  } catch (err) {
    console.error("[destination-details] Error:", err instanceof Error ? err.message : err);
    if (err instanceof AIGatewayError) {
      if (err.code === "AI_CONFIG_ERROR") {
        return NextResponse.json({ error: "AI service is not configured" }, { status: 503 });
      }
      if (err.code === "AI_RATE_LIMITED") {
        return NextResponse.json(
          { error: "AI service is rate limited. Please wait a minute and try again." },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }
      if (err.code === "AI_INVALID_OUTPUT") {
        return NextResponse.json({ error: "AI returned an unexpected response format" }, { status: 502 });
      }
      return NextResponse.json({ error: "AI service is temporarily unavailable. Please try again." }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
