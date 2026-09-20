/**
 * DB-backed rate limiting for serverless environments.
 *
 * Uses a PostgreSQL `RateLimitEntry` table (via Prisma) to share rate limit state
 * across multiple serverless instances — no shared in-memory store needed.
 *
 * Falls back to the in-memory implementation if DB is unavailable.
 *
 * Usage:
 *   const { allowed, retryAfterSeconds } = await checkRateLimitDb(key, 5, 60000);
 *   if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

import { prisma } from "./db";
import { checkRateLimit as checkRateLimitMemory } from "./rate-limit";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
};

/**
 * Atomically check and increment a rate limit counter in the database.
 * Uses a simple upsert approach instead of interactive transactions
 * to avoid Neon pooler transaction timeout issues (P2028).
 *
 * @param key - Unique identifier for this rate limit bucket (e.g., "chat-planner:userId:ip")
 * @param maxAttempts - Maximum requests allowed within the window
 * @param windowMs - Rolling window size in milliseconds
 */
export async function checkRateLimitDb(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000,
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    // First, check if entry exists and is still valid
    const existing = await prisma.rateLimitEntry.findUnique({
      where: { key },
    });

    let count: number;
    let entryResetAt: Date;

    if (!existing || existing.resetAt <= now) {
      // Window expired or no entry: reset to 1
      const entry = await prisma.rateLimitEntry.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      count = entry.count;
      entryResetAt = entry.resetAt;
    } else {
      // Within window: increment
      const updated = await prisma.rateLimitEntry.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      count = updated.count;
      entryResetAt = updated.resetAt;
    }

    const allowed = count <= maxAttempts;
    const retryAfterSeconds = allowed
      ? 0
      : Math.ceil((entryResetAt.getTime() - now.getTime()) / 1000);

    return { allowed, retryAfterSeconds, count };
  } catch (error) {
    // DB unavailable: fall back to in-memory limiter (logged warning)
    console.warn("[RateLimit] DB unavailable, falling back to in-memory:", (error as Error).message);
    const memResult = checkRateLimitMemory(key);
    return {
      allowed: memResult.allowed,
      retryAfterSeconds: memResult.retryAfterSeconds,
      count: 0,
    };
  }
}

/**
 * Reset a rate limit entry (e.g., for test cleanup).
 */
export async function resetRateLimitDb(key: string): Promise<void> {
  try {
    await prisma.rateLimitEntry.deleteMany({ where: { key } });
  } catch {
    // Ignore if not found
  }
}
