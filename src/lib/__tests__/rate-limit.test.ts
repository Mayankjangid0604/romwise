import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit, MAX_ATTEMPTS, WINDOW_MS } from "../rate-limit";

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = checkRateLimit("test-key");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks after exceeding the limit", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit("test-key");
    }
    const result = checkRateLimit("test-key");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit("key-a");
    }
    const blocked = checkRateLimit("key-a");
    expect(blocked.allowed).toBe(false);

    const other = checkRateLimit("key-b");
    expect(other.allowed).toBe(true);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        checkRateLimit("test-key");
      }
      expect(checkRateLimit("test-key").allowed).toBe(false);

      vi.advanceTimersByTime(WINDOW_MS + 1);
      expect(checkRateLimit("test-key").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets on explicit resetRateLimit call", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit("test-key");
    }
    expect(checkRateLimit("test-key").allowed).toBe(false);

    resetRateLimit("test-key");
    expect(checkRateLimit("test-key").allowed).toBe(true);
  });

  it("returns retryAfterSeconds within the window duration", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit("test-key");
    }
    const result = checkRateLimit("test-key");
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
