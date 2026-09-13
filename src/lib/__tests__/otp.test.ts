import { describe, it, expect } from "vitest";
import { validatePhone, generateOtpCode } from "../otp";

describe("validatePhone", () => {
  it("accepts valid Indian mobile number with +91 prefix", () => {
    const result = validatePhone("+919876543210");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("+919876543210");
  });

  it("accepts number without country code", () => {
    const result = validatePhone("9876543210");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("+919876543210");
  });

  it("strips spaces and dashes", () => {
    const result = validatePhone("+91 98765 43210");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("+919876543210");
  });

  it("strips parentheses", () => {
    const result = validatePhone("+91 (987) 654-3210");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("+919876543210");
  });

  it("rejects numbers not starting with 6-9", () => {
    const result = validatePhone("+915876543210");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects too-short numbers", () => {
    const result = validatePhone("987654321");
    expect(result.valid).toBe(false);
  });

  it("rejects too-long numbers", () => {
    const result = validatePhone("98765432100");
    expect(result.valid).toBe(false);
  });

  it("rejects empty input", () => {
    const result = validatePhone("");
    expect(result.valid).toBe(false);
  });

  it("rejects non-Indian country codes", () => {
    const result = validatePhone("+14155552671");
    expect(result.valid).toBe(false);
  });
});

describe("generateOtpCode", () => {
  it("generates a 6-digit code", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("generates codes that are at least 100000", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode();
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThan(1000000);
    }
  });
});
