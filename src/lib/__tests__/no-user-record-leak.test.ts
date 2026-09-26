import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression guard: a Prisma relation to `User` loaded with `true` (e.g.
 * `include: { user: true }`) pulls the whole row — passwordHash, email, phone,
 * role — and pages were handing those objects to client components, which
 * serialized every trip member's bcrypt hash into the HTML. Always `select` the
 * fields actually needed (usually `{ name: true }`).
 */

const SRC = path.resolve(__dirname, "../..");
const SCHEMA = path.resolve(__dirname, "../../../prisma/schema.prisma");

function userRelationFields(): string[] {
  const schema = fs.readFileSync(SCHEMA, "utf-8");
  const fields = new Set<string>();
  for (const m of schema.matchAll(/^\s+(\w+)\s+User\??\s+@relation/gm)) fields.add(m[1]);
  return [...fields];
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("no full User records leave the server", () => {
  const fields = userRelationFields();

  it("finds the User relation names in the schema", () => {
    expect(fields).toEqual(expect.arrayContaining(["user", "creator", "payer"]));
  });

  it("never loads a User relation with `true` (select explicit fields instead)", () => {
    const pattern = new RegExp(`\\b(${fields.join("|")})\\s*:\\s*true\\b`);
    const offenders = sourceFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, "utf-8")
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => pattern.test(line) && !line.trim().startsWith("//"))
        .map(({ n, line }) => `${path.relative(SRC, file)}:${n}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("never selects passwordHash outside the credential check", () => {
    const allowed = new Set(["lib/auth.ts", "app/actions/auth.ts"]);
    const offenders = sourceFiles(SRC).filter(
      (file) => !allowed.has(path.relative(SRC, file)) && /passwordHash\s*:\s*true/.test(fs.readFileSync(file, "utf-8")),
    );
    expect(offenders).toEqual([]);
  });
});
