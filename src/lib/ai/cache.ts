/**
 * Response cache for AI (Gemini) calls whose output is a pure function of their input.
 *
 * Why DB-backed (AiResponseCache table) rather than in-memory only: production runs
 * on serverless functions, where each instance has its own memory and cold starts
 * wipe it, so an in-memory cache would rarely hit and would differ per instance
 * (the same reason rate limiting moved to RateLimitEntry). A small in-process L1
 * sits in front so repeat hits on a warm instance skip even the DB round trip.
 *
 * Correctness rules:
 * - Keys hash the task, model, a prompt *version* (callers pass a hash of their
 *   system prompt, so editing the prompt invalidates old entries) and the input.
 * - Input normalization is deliberately conservative: only case, whitespace,
 *   punctuation spacing, Unicode width forms and thousands separators are folded.
 *   Anything that can change meaning (numbers, words, order) stays in the key, so
 *   "3 days in Goa" and "5 days in Goa" can never share an entry.
 * - Only validated successful responses are stored; errors are never cached.
 * - A cached value that no longer passes the caller's validator is treated as a miss.
 * - Cache failures (DB down, etc.) never fail the request — it just calls the provider.
 */
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const L1_MAX_ENTRIES = 200;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

type L1Entry = { value: unknown; expiresAt: number };
const l1 = new Map<string, L1Entry>();
let lastPruneAt = 0;

/** Fold only formatting differences that cannot change a prompt's meaning. */
export function normalizePromptText(text: string): string {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      // "50,000" / "1,00,000" / "1,234,567" → digits only (grouping separators, not lists like "1,2")
      .replace(/\b\d{1,3}(?:,\d{2,3})*,\d{3}\b/g, (n) => n.replace(/,/g, ""))
      // No space before punctuation, exactly one after
      .replace(/\s+([,.!?;:])/g, "$1")
      .replace(/([,!?;:])(?=[^\s,.!?;:])/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim()
      // Trailing sentence punctuation ("Goa trip!!!" ≈ "goa trip")
      .replace(/[.!?]+$/, "")
      .trim()
  );
}

/** JSON with sorted object keys, so structurally equal inputs hash identically. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function buildAiCacheKey(parts: { task: string; model: string; version: string; input: unknown }): string {
  return sha256(canonicalJson({ t: parts.task, m: parts.model, v: parts.version, i: parts.input }));
}

export type AiCacheOptions<T> = {
  task: string;
  model: string;
  /** Changes whenever the prompt changes, e.g. sha256(systemPrompt).slice(0, 12). */
  version: string;
  /** Already-normalized input; hashed with canonicalJson. */
  input: unknown;
  ttlMs: number;
  /** Re-validate cached data; return null to treat an entry as a miss. */
  validate: (data: unknown) => T | null;
};

export type AiCacheResult<T> = { value: T; cacheHit: boolean };

function l1Get(key: string, now: number): unknown | undefined {
  const entry = l1.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    l1.delete(key);
    return undefined;
  }
  // Refresh recency for LRU eviction
  l1.delete(key);
  l1.set(key, entry);
  return entry.value;
}

function l1Set(key: string, value: unknown, expiresAt: number) {
  // Store a copy: callers may mutate the object they get back
  l1.set(key, { value: structuredClone(value), expiresAt });
  while (l1.size > L1_MAX_ENTRIES) {
    const oldest = l1.keys().next().value;
    if (oldest === undefined) break;
    l1.delete(oldest);
  }
}

export async function withAiCache<T>(
  opts: AiCacheOptions<T>,
  compute: () => Promise<T>,
): Promise<AiCacheResult<T>> {
  const key = buildAiCacheKey(opts);
  const now = Date.now();

  const fromMemory = l1Get(key, now);
  if (fromMemory !== undefined) {
    const valid = opts.validate(structuredClone(fromMemory));
    if (valid !== null) return { value: valid, cacheHit: true };
    l1.delete(key);
  }

  try {
    const row = await prisma.aiResponseCache.findUnique({ where: { key } });
    if (row && row.expiresAt.getTime() > now) {
      const valid = opts.validate(row.response);
      if (valid !== null) {
        l1Set(key, row.response, row.expiresAt.getTime());
        void prisma.aiResponseCache
          .update({ where: { key }, data: { hits: { increment: 1 } } })
          .catch(() => {});
        return { value: valid, cacheHit: true };
      }
    }
  } catch (err) {
    console.warn("[AI cache] lookup failed, calling provider:", (err as Error).message);
  }

  // Miss: errors propagate and are never cached
  const value = await compute();
  const expiresAt = now + opts.ttlMs;
  l1Set(key, value, expiresAt);

  try {
    const data = {
      task: opts.task,
      model: opts.model,
      response: value as Prisma.InputJsonValue,
      expiresAt: new Date(expiresAt),
    };
    await prisma.aiResponseCache.upsert({
      where: { key },
      create: { key, ...data },
      update: { ...data, hits: 0, createdAt: new Date(now) },
    });
    if (now - lastPruneAt > PRUNE_INTERVAL_MS) {
      lastPruneAt = now;
      void prisma.aiResponseCache.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => {});
    }
  } catch (err) {
    console.warn("[AI cache] store failed:", (err as Error).message);
  }

  return { value, cacheHit: false };
}

/** Test helper: clears the in-process layer. */
export function clearAiCacheMemory() {
  l1.clear();
  lastPruneAt = 0;
}
