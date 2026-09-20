/**
 * In-memory rate limiter.
 *
 * @remarks
 * SEC-002 — KNOWN LIMITATION: This is a process-local in-memory store.
 * On serverless deployments (Vercel, AWS Lambda, Cloud Run) each function
 * instance has its own Map. If the application is horizontally scaled
 * across multiple instances, the rate limit is enforced per-instance and
 * NOT globally. An attacker can bypass this by hitting different instances.
 *
 * MIGRATION PATH: Replace `attempts` with a Redis-backed store (e.g.,
 * Upstash Redis with the @upstash/ratelimit package) to enforce limits
 * globally across all instances. The API surface below can remain unchanged.
 *
 * For the current single-instance / Vercel hobby tier deployment, this is
 * acceptable. Revisit before multi-instance production scale-out.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

export { MAX_ATTEMPTS, WINDOW_MS };
