import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  analyzeGroupAlignment,
  validateGroupAlignmentInput,
} from "@/lib/group-alignment";
import { ValidationError } from "@/lib/discovery";
import { GeminiConfigError, GeminiProviderError, GeminiSchemaError } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (error instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 503 },
      );
    }
    if (error instanceof GeminiProviderError) {
      return NextResponse.json(
        { error: "AI service is temporarily unavailable" },
        { status: 502 },
      );
    }
    if (error instanceof GeminiSchemaError) {
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
