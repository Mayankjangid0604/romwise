import { describe, it, expect } from "vitest";
import { hash, compare } from "bcryptjs";

describe("auth password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const password = "securepassword123";
    const hashed = await hash(password, 12);

    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(20);

    const isValid = await compare(password, hashed);
    expect(isValid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const password = "securepassword123";
    const hashed = await hash(password, 12);

    const isValid = await compare("wrongpassword", hashed);
    expect(isValid).toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const password = "securepassword123";
    const hash1 = await hash(password, 12);
    const hash2 = await hash(password, 12);

    expect(hash1).not.toBe(hash2);

    expect(await compare(password, hash1)).toBe(true);
    expect(await compare(password, hash2)).toBe(true);
  });

  it("validates password requirements", () => {
    const validate = (password: string) => {
      if (!password) return "Password is required";
      if (password.length < 8) return "Password must be at least 8 characters";
      return null;
    };

    expect(validate("")).toBe("Password is required");
    expect(validate("short")).toBe("Password must be at least 8 characters");
    expect(validate("12345678")).toBeNull();
    expect(validate("securepassword")).toBeNull();
  });

  it("validates email format", () => {
    const isValidEmail = (email: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user@test.co.in")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
  });
});
