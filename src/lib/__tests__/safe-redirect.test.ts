import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "../safe-redirect";

describe("safeCallbackUrl", () => {
  it.each([
    ["/trips/join/abc123", "/trips/join/abc123"],
    ["/trips/t1/itinerary?day=2", "/trips/t1/itinerary?day=2"],
    ["/discovery/Goa", "/discovery/Goa"],
    ["/trips/../dashboard", "/dashboard"],
  ])("keeps in-app path %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/trips\u0000/x",
    "dashboard",
    "/login",
    "/login?callbackUrl=/login",
    "/signup",
    "/api/auth/signout",
    "/" + "a".repeat(600),
  ])("falls back to /dashboard for %s", (input) => {
    expect(safeCallbackUrl(input)).toBe("/dashboard");
  });

  it("uses the provided fallback", () => {
    expect(safeCallbackUrl("https://x.y", "")).toBe("");
  });
});
