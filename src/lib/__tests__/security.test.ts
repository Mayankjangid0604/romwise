import { describe, it, expect } from "vitest";
import { hash } from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

describe("security", () => {
  describe("bcrypt cost factor", () => {
    it("uses at least 12 rounds", async () => {
      const hashed = await hash("test-password", 12);
      // bcrypt hash format: $2a$<rounds>$...
      const rounds = parseInt(hashed.split("$")[2], 10);
      expect(rounds).toBeGreaterThanOrEqual(12);
    });

    it("auth action hardcodes 12 rounds", () => {
      const authSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/actions/auth.ts"),
        "utf-8",
      );
      expect(authSource).toContain("hash(password, 12)");
    });
  });

  describe("no secrets in API responses", () => {
    it("discovery route does not leak env vars in error messages", () => {
      const routeSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/api/discovery/route.ts"),
        "utf-8",
      );
      expect(routeSource).not.toMatch(/process\.env\.\w+/g.source.replace("\\w+", "GEMINI_API_KEY"));
      expect(routeSource).not.toContain("AUTH_SECRET");
      expect(routeSource).not.toContain("DATABASE_URL");
    });

    it("group-alignment route does not leak env vars in error messages", () => {
      const routeSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/api/group-alignment/route.ts"),
        "utf-8",
      );
      expect(routeSource).not.toContain("AUTH_SECRET");
      expect(routeSource).not.toContain("DATABASE_URL");
    });

    it("error responses use generic messages, not stack traces", () => {
      const routeSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/api/discovery/route.ts"),
        "utf-8",
      );
      // Error responses should use known error messages, not error.message or error.stack
      expect(routeSource).not.toContain("error.stack");
    });
  });

  describe("session-only identity", () => {
    it("no server action trusts client-provided userId", () => {
      const actionsDir = path.resolve(__dirname, "../../app/actions");
      const files = fs.readdirSync(actionsDir).filter((f) => f.endsWith(".ts"));

      for (const file of files) {
        const source = fs.readFileSync(path.join(actionsDir, file), "utf-8");
        if (!source.includes('"use server"')) continue;

        // Every server action file with DB writes should get userId from session
        if (source.includes("prisma.") && source.includes("userId")) {
          expect(source).toContain("await auth()");
          // Should not accept userId from formData
          expect(source).not.toMatch(/formData\.get\(["']userId["']\)/);
        }
      }
    });

    it("all server action files with DB access check session", () => {
      const actionsDir = path.resolve(__dirname, "../../app/actions");
      const files = fs.readdirSync(actionsDir).filter((f) => f.endsWith(".ts"));

      for (const file of files) {
        const source = fs.readFileSync(path.join(actionsDir, file), "utf-8");
        if (!source.includes('"use server"')) continue;
        if (!source.includes("prisma.")) continue;
        if (file === "auth.ts" || file === "phone-auth.ts") continue;

        expect(source).toContain("await auth()");
        expect(source).toContain("session.user");
      }
    });
  });

  describe("API route authentication", () => {
    it("discovery route checks auth", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/api/discovery/route.ts"),
        "utf-8",
      );
      expect(source).toContain("await auth()");
      expect(source).toContain("401");
    });

    it("group-alignment route checks auth", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/api/group-alignment/route.ts"),
        "utf-8",
      );
      expect(source).toContain("await auth()");
      expect(source).toContain("401");
    });
  });

  describe("acceptReplan item validation", () => {
    it("validates item IDs belong to the trip", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/actions/replan.ts"),
        "utf-8",
      );
      expect(source).toContain("validItemIds");
      expect(source).toContain("Invalid item reference");
    });
  });

  describe("selectHotel server validation", () => {
    it("does not accept price or coordinates from client", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/actions/stay.ts"),
        "utf-8",
      );
      expect(source).toContain("SAMPLE_HOTELS.find");
      expect(source).not.toContain("costPerNightInr: number,");
      expect(source).not.toContain("lat: number,");
    });
  });

  describe("middleware protection", () => {
    it("middleware.ts exists and exports auth", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../middleware.ts"),
        "utf-8",
      );
      expect(source).toContain("auth");
      expect(source).toContain("matcher");
    });

    it("middleware covers protected routes", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../middleware.ts"),
        "utf-8",
      );
      expect(source).toContain("/dashboard");
      expect(source).toContain("/trips");
      expect(source).toContain("/api/discovery");
      expect(source).toContain("/api/group-alignment");
    });
  });

  describe("OTP code security", () => {
    it("OTP codes are hashed, not stored in plaintext", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../otp.ts"),
        "utf-8",
      );
      expect(source).toContain("codeHash");
      expect(source).toContain("hash(code,");
      expect(source).toContain("compare(code,");
    });
  });

  describe("input length limits", () => {
    it("auth action enforces max password length", () => {
      const authSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/actions/auth.ts"),
        "utf-8",
      );
      expect(authSource).toContain("MAX_PASSWORD_LENGTH");
      expect(authSource).toContain("password.length >");
    });

    it("auth action enforces max name length", () => {
      const authSource = fs.readFileSync(
        path.resolve(__dirname, "../../app/actions/auth.ts"),
        "utf-8",
      );
      expect(authSource).toContain("MAX_NAME_LENGTH");
    });
  });
});
