import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  normalizePromptText,
  buildAiCacheKey,
  canonicalJson,
  withAiCache,
  clearAiCacheMemory,
} from "../cache";

// In-memory stand-in for the AiResponseCache table
const table = new Map<string, { key: string; response: unknown; expiresAt: Date; hits: number }>();
vi.mock("@/lib/db", () => ({
  prisma: {
    aiResponseCache: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => table.get(where.key) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { response: unknown; expiresAt: Date } }) => {
        table.set(where.key, { key: where.key, response: create.response, expiresAt: create.expiresAt, hits: 0 });
      }),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

const key = (text: string) =>
  buildAiCacheKey({ task: "conversation", model: "m", version: "v1", input: normalizePromptText(text) });

describe("normalizePromptText: folds formatting only", () => {
  it.each([
    ["Plan 5 days in Goa for 2 people, budget 50000", "plan 5 days in goa for 2 people, budget 50000"],
    ["  Plan 5 days   in Goa\nfor 2 people ,budget 50,000!! ", "Plan 5 days in Goa for 2 people, budget 50000"],
    ["Budget ₹1,00,000 for Manali", "budget ₹100000 for manali"],
    ["Is Goa good in May?", "is goa good in may"],
    ["ＧＯＡ trip", "goa trip"], // full-width characters (NFKC)
  ])("%j ≡ %j", (a, b) => {
    expect(normalizePromptText(a)).toBe(normalizePromptText(b));
    expect(key(a)).toBe(key(b));
  });
});

describe("normalizePromptText: never merges meaningfully different queries", () => {
  it.each([
    ["3 days in Goa", "5 days in Goa"],
    ["5 days in Goa", "5 days in Manali"],
    ["budget 50,000", "budget 5,000"],
    ["budget 50000", "budget 500000"],
    ["days 1,2", "days 12"],
    ["2 people", "20 people"],
    ["not crowded beaches", "crowded beaches"],
    ["Goa then Hampi", "Hampi then Goa"],
    ["2.5 lakh budget", "25 lakh budget"],
  ])("%j ≠ %j", (a, b) => {
    expect(key(a)).not.toBe(key(b));
  });

  it("keys differ by task, model and prompt version", () => {
    const base = { task: "conversation", model: "m", version: "v1", input: "goa" };
    const k = buildAiCacheKey(base);
    expect(buildAiCacheKey({ ...base, task: "group_alignment" })).not.toBe(k);
    expect(buildAiCacheKey({ ...base, model: "m2" })).not.toBe(k);
    expect(buildAiCacheKey({ ...base, version: "v2" })).not.toBe(k);
  });

  it("canonicalJson ignores object key order but not array order", () => {
    expect(canonicalJson({ a: 1, b: [1, 2] })).toBe(canonicalJson({ b: [1, 2], a: 1 }));
    expect(canonicalJson({ b: [2, 1] })).not.toBe(canonicalJson({ b: [1, 2] }));
  });
});

describe("withAiCache", () => {
  type Answer = { answer: string };
  const validate = (d: unknown) =>
    d && typeof (d as Answer).answer === "string" ? (d as Answer) : null;
  const opts = (input: unknown, ttlMs = 60_000) => ({ task: "t", model: "m", version: "v", input, ttlMs, validate });

  beforeEach(() => {
    table.clear();
    clearAiCacheMemory();
    vi.clearAllMocks();
  });

  it("miss calls the provider once and stores; the repeat is a hit without a provider call", async () => {
    const compute = vi.fn(async () => ({ answer: "Goa in November" }));
    const first = await withAiCache(opts("goa"), compute);
    const second = await withAiCache(opts("goa"), compute);

    expect(first).toEqual({ value: { answer: "Goa in November" }, cacheHit: false });
    expect(second).toEqual({ value: { answer: "Goa in November" }, cacheHit: true });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(prisma.aiResponseCache.upsert).toHaveBeenCalledTimes(1);
  });

  it("serves hits from the DB layer across instances (cold in-memory layer)", async () => {
    const compute = vi.fn(async () => ({ answer: "x" }));
    await withAiCache(opts("goa"), compute);
    clearAiCacheMemory(); // simulate another serverless instance
    const again = await withAiCache(opts("goa"), compute);
    expect(again.cacheHit).toBe(true);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("different input is a miss", async () => {
    const compute = vi.fn(async () => ({ answer: "x" }));
    await withAiCache(opts("goa"), compute);
    const other = await withAiCache(opts("manali"), compute);
    expect(other.cacheHit).toBe(false);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("expired entries are misses", async () => {
    vi.useFakeTimers();
    try {
      const compute = vi.fn(async () => ({ answer: "x" }));
      await withAiCache(opts("goa", 1_000), compute);
      vi.advanceTimersByTime(1_001);
      const later = await withAiCache(opts("goa", 1_000), compute);
      expect(later.cacheHit).toBe(false);
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a cached value that fails validation is treated as a miss", async () => {
    const k = buildAiCacheKey(opts("goa"));
    table.set(k, { key: k, response: { wrong: "shape" }, expiresAt: new Date(Date.now() + 60_000), hits: 0 });
    const compute = vi.fn(async () => ({ answer: "fresh" }));
    const res = await withAiCache(opts("goa"), compute);
    expect(res).toEqual({ value: { answer: "fresh" }, cacheHit: false });
  });

  it("provider errors propagate and are never cached", async () => {
    const failing = vi.fn(async () => {
      throw new Error("provider down");
    });
    await expect(withAiCache(opts("goa"), failing)).rejects.toThrow("provider down");
    expect(prisma.aiResponseCache.upsert).not.toHaveBeenCalled();

    const ok = vi.fn(async () => ({ answer: "ok" }));
    expect((await withAiCache(opts("goa"), ok)).cacheHit).toBe(false);
  });

  it("still answers when the cache table is unavailable", async () => {
    vi.mocked(prisma.aiResponseCache.findUnique).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(prisma.aiResponseCache.upsert).mockRejectedValueOnce(new Error("db down"));
    const compute = vi.fn(async () => ({ answer: "ok" }));
    const res = await withAiCache(opts("goa"), compute);
    expect(res).toEqual({ value: { answer: "ok" }, cacheHit: false });
  });

  it("callers mutating a returned value cannot corrupt the cache", async () => {
    const compute = vi.fn(async () => ({ answer: "original" }));
    const first = await withAiCache(opts("goa"), compute);
    first.value.answer = "mutated by caller";
    const second = await withAiCache(opts("goa"), compute);
    expect(second.value.answer).toBe("original");
  });
});
