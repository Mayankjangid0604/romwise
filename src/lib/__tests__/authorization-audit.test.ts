import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Static guard for the read-only "viewer" role (people who joined via a viewer invite).
 * Every exported server action that writes to the database must enforce edit rights,
 * unless it only touches the caller's own data or has its own stricter rule.
 *
 * The 2026-09-26 audit found viewers could regenerate (wipe) the itinerary, run the
 * budget optimizer (deletes items), accept replans, edit packing and pick hotels.
 */

const ACTIONS_DIR = path.resolve(__dirname, "../../app/actions");

const WRITE = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$transaction\(/;
const EDIT_GUARD = /canEditTrip\(|role === "viewer"|requireTripRole\([^)]*"(member|creator)"\)/;

// Actions that write only the caller's own records, or are gated differently (documented here).
const OWN_DATA_OR_OTHER_RULE = new Set([
  "auth.ts:signup", // creates the caller's own account
  "phone-auth.ts:verifyOtpAction", // creates/updates the caller's own account
  "trips.ts:createTrip", // caller becomes creator of a new trip
  "trips.ts:updateAccessibilityNotes", // updateMany scoped to { tripId, userId: session user }
  "trips.ts:deleteTrip", // creator-only check (creatorId === session user)
  "template-actions.ts:createTripFromTemplate", // new trip owned by the caller
  "preferences.ts:updatePreference", // the caller's own preferences (viewers allowed by design)
  "preferences.ts:deletePreference",
  "group.ts:leaveGroup", // removes the caller's own membership
  "collaboration.ts:deleteComment", // own comment, or creator for any comment
]);

function exportedFunctions(source: string): { name: string; body: string }[] {
  const starts = [...source.matchAll(/export async function (\w+)\s*\(/g)];
  return starts.map((m, i) => ({
    name: m[1],
    body: source.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : source.length),
  }));
}

describe("authorization: viewers are read-only", () => {
  const files = fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("every mutating server action enforces edit rights (or is an audited exception)", () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(ACTIONS_DIR, file), "utf-8");
      for (const fn of exportedFunctions(source)) {
        const id = `${file}:${fn.name}`;
        if (!WRITE.test(fn.body) || OWN_DATA_OR_OTHER_RULE.has(id)) continue;
        if (!EDIT_GUARD.test(fn.body)) missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it("the exception list only names functions that still exist", () => {
    const existing = new Set(
      files.flatMap((file) =>
        exportedFunctions(fs.readFileSync(path.join(ACTIONS_DIR, file), "utf-8")).map((fn) => `${file}:${fn.name}`),
      ),
    );
    expect([...OWN_DATA_OR_OTHER_RULE].filter((id) => !existing.has(id))).toEqual([]);
  });

  it("trip mutation API routes reject viewers", () => {
    for (const route of ["stay", "transit", "expenses"]) {
      const source = fs.readFileSync(path.resolve(__dirname, `../../app/api/trips/[id]/${route}/route.ts`), "utf-8");
      expect(source, route).toMatch(/canEditTrip\(|role === "viewer"/);
    }
  });
});
