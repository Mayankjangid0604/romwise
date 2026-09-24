import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  analyzeGroupAlignment,
  validateGroupAlignmentInput,
} from "@/lib/group-alignment";
import { AIGatewayError } from "@/lib/ai/types";
import { ValidationError } from "@/lib/group-alignment";
import { checkRateLimitDb } from "@/lib/db-rate-limit";
import { headers } from "next/headers";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 requests / 15 min per user to prevent AI cost abuse
  const ip = await getClientIp();
  const rateLimitKey = `group-alignment:${session.user.id}:${ip}`;
  const { allowed, retryAfterSeconds } = await checkRateLimitDb(rateLimitKey);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  let input;
  try {
    input = validateGroupAlignmentInput(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const result = await analyzeGroupAlignment(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIGatewayError) {
      if (error.code === "AI_CONFIG_ERROR") {
        return NextResponse.json(
          { error: "AI service is not configured" },
          { status: 503 },
        );
      }
      if (error.code === "AI_INVALID_OUTPUT") {
        return NextResponse.json(
          { error: "AI returned an unexpected response format" },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: "AI service is temporarily unavailable" },
        { status: 502 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "AI returned an unexpected response format" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
