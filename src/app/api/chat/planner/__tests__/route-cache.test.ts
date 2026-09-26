import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import * as authModule from "@/lib/auth";
import { AIGateway } from "@/lib/ai/gateway";
import { clearAiCacheMemory } from "@/lib/ai/cache";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({ AIGateway: { generateStructured: vi.fn() } }));
vi.mock("@/lib/db-rate-limit", () => ({
  checkRateLimitDb: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("@/lib/destination-resolver", () => ({
  resolveDestination: vi.fn().mockResolvedValue({ id: "goa", name: "Goa", lat: 15.4, lng: 73.8 }),
  searchTravelDestinations: vi.fn().mockResolvedValue([]),
}));

const table = new Map<string, { response: unknown; expiresAt: Date }>();
vi.mock("@/lib/db", () => ({
  prisma: {
    aiResponseCache: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => table.get(where.key) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { response: unknown; expiresAt: Date } }) => {
        table.set(where.key, { response: create.response, expiresAt: create.expiresAt });
      }),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

const aiAnswer = {
  type: "complete",
  message: "5 days in Goa for 2 — ready to plan!",
  extractedData: { destination: "Goa", budgetInr: 50000, maxTravelers: 2, paceLevel: "balanced" },
};

function request(content: string) {
  return {
    headers: new Map<string, string>(),
    json: async () => ({ messages: [{ role: "user", content }] }),
  } as unknown as Request;
}

describe("POST /api/chat/planner — AI response cache", () => {
  beforeEach(() => {
    table.clear();
    clearAiCacheMemory();
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({ data: aiAnswer } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers a repeated prompt from cache without calling Gemini again", async () => {
    const first = await POST(request("Plan 5 days in Goa for 2 people, budget 50000"));
    const second = await POST(request("plan 5 days in goa for 2 people,  budget 50,000!"));

    expect(first.headers.get("X-Roamwise-AI-Cache")).toBe("miss");
    expect(second.headers.get("X-Roamwise-AI-Cache")).toBe("hit");
    expect(await second.json()).toEqual(await first.json());
    expect(AIGateway.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an answer for a meaningfully different prompt", async () => {
    await POST(request("Plan 5 days in Goa for 2 people"));
    const other = await POST(request("Plan 3 days in Goa for 2 people"));
    expect(other.headers.get("X-Roamwise-AI-Cache")).toBe("miss");
    expect(AIGateway.generateStructured).toHaveBeenCalledTimes(2);
  });

  it("does not serve yesterday's answer (relative dates)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));
    await POST(request("Weekend in Goa next month"));
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    const nextDay = await POST(request("Weekend in Goa next month"));
    expect(nextDay.headers.get("X-Roamwise-AI-Cache")).toBe("miss");
    expect(AIGateway.generateStructured).toHaveBeenCalledTimes(2);
  });

  it("never caches an invalid AI response", async () => {
    vi.mocked(AIGateway.generateStructured).mockResolvedValueOnce({ data: { type: "complete" } } as never);
    const bad = await POST(request("Goa"));
    expect(bad.status).toBe(502);
    expect(table.size).toBe(0);

    const good = await POST(request("Goa"));
    expect(good.status).toBe(200);
    expect(good.headers.get("X-Roamwise-AI-Cache")).toBe("miss");
  });
});
