/**
 * Tests for destination-hierarchy.ts:
 *   - getDestinationDescendants (BFS, cycle guard, leaf destinations)
 *   - detectHierarchyCycles (DFS, multi-level, no false positives)
 *   - findOrphanChildren
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    travelDestination: {
      findMany: vi.fn(),
    },
  },
}));

import {
  getDestinationDescendants,
  detectHierarchyCycles,
  findOrphanChildren,
} from "../destination-hierarchy";
import { prisma } from "@/lib/db";

const mockFindMany = vi.mocked(prisma.travelDestination.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getDestinationDescendants ────────────────────────────────────────────────

describe("getDestinationDescendants", () => {
  it("leaf destination returns only itself", async () => {
    mockFindMany.mockResolvedValueOnce([]); // no children
    const result = await getDestinationDescendants("dest-leaf");
    expect(result).toEqual(["dest-leaf"]);
  });

  it("destination with one child returns both IDs", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "dest-child" }] as never)
      .mockResolvedValueOnce([]); // child has no children
    const result = await getDestinationDescendants("dest-parent");
    expect(result).toContain("dest-parent");
    expect(result).toContain("dest-child");
    expect(result).toHaveLength(2);
  });

  it("Goa (parent) includes Panaji and North Goa sub-destinations", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "dest-panaji" }, { id: "dest-north-goa" }] as never)
      .mockResolvedValueOnce([]); // no grandchildren
    const result = await getDestinationDescendants("dest-goa");
    expect(result).toContain("dest-goa");
    expect(result).toContain("dest-panaji");
    expect(result).toContain("dest-north-goa");
  });

  it("three-level hierarchy (region → city → area) returns all levels", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "dest-city" }] as never)          // region's children
      .mockResolvedValueOnce([{ id: "dest-area" }] as never)          // city's children
      .mockResolvedValueOnce([]);                                       // area has no children
    const result = await getDestinationDescendants("dest-region");
    expect(result).toContain("dest-region");
    expect(result).toContain("dest-city");
    expect(result).toContain("dest-area");
  });

  it("never visits the same node twice even if DB returns duplicates", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "dest-child" }, { id: "dest-child" }] as never) // duplicate
      .mockResolvedValueOnce([]);
    const result = await getDestinationDescendants("dest-parent");
    const unique = new Set(result);
    expect(unique.size).toBe(result.length); // no duplicates
  });

  it("terminates within MAX_DEPTH even if DB always returns children (cycle guard)", async () => {
    // Simulate a very deep chain — BFS stops at MAX_DEPTH=8 even if children keep returning.
    for (let i = 0; i < 10; i++) {
      mockFindMany.mockResolvedValueOnce([{ id: `level-${i + 1}` }] as never);
    }
    const result = await getDestinationDescendants("root");
    // MAX_DEPTH=8 → at most 9 nodes (root + 8 levels)
    expect(result.length).toBeLessThanOrEqual(9);
  });
});

// ── detectHierarchyCycles ────────────────────────────────────────────────────

describe("detectHierarchyCycles", () => {
  it("flat list with no parents returns no cycles", () => {
    const records = [
      { id: "a", parentDestinationId: null },
      { id: "b", parentDestinationId: null },
      { id: "c", parentDestinationId: null },
    ];
    expect(detectHierarchyCycles(records)).toHaveLength(0);
  });

  it("simple valid tree (no cycles) returns empty", () => {
    const records = [
      { id: "region", parentDestinationId: null },
      { id: "city", parentDestinationId: "region" },
      { id: "area", parentDestinationId: "city" },
    ];
    expect(detectHierarchyCycles(records)).toHaveLength(0);
  });

  it("two-node cycle A→B→A is detected", () => {
    const records = [
      { id: "a", parentDestinationId: "b" },
      { id: "b", parentDestinationId: "a" },
    ];
    const cycles = detectHierarchyCycles(records);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("three-node cycle A→B→C→A is detected", () => {
    const records = [
      { id: "a", parentDestinationId: "c" },
      { id: "b", parentDestinationId: "a" },
      { id: "c", parentDestinationId: "b" },
    ];
    const cycles = detectHierarchyCycles(records);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("self-reference (A→A) is detected", () => {
    const records = [{ id: "a", parentDestinationId: "a" }];
    const cycles = detectHierarchyCycles(records);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("cycle in one branch does not contaminate unrelated branch", () => {
    const records = [
      // Clean branch
      { id: "root", parentDestinationId: null },
      { id: "leaf", parentDestinationId: "root" },
      // Cyclic branch
      { id: "x", parentDestinationId: "y" },
      { id: "y", parentDestinationId: "x" },
    ];
    const cycles = detectHierarchyCycles(records);
    // Only x and y should appear, not root or leaf
    const cycleIds = cycles.map((c) => c.id);
    expect(cycleIds).not.toContain("root");
    expect(cycleIds).not.toContain("leaf");
    expect(cycles.length).toBeGreaterThan(0);
  });
});

// ── findOrphanChildren ───────────────────────────────────────────────────────

describe("findOrphanChildren", () => {
  it("no orphans in a complete tree", () => {
    const records = [
      { id: "a", name: "Region", parentDestinationId: null },
      { id: "b", name: "City", parentDestinationId: "a" },
    ];
    expect(findOrphanChildren(records)).toHaveLength(0);
  });

  it("detects a child whose parent is missing from the set", () => {
    const records = [
      { id: "b", name: "City", parentDestinationId: "missing-parent" },
    ];
    const orphans = findOrphanChildren(records);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].id).toBe("b");
    expect(orphans[0].missingParentId).toBe("missing-parent");
  });

  it("top-level destinations (null parent) are never orphans", () => {
    const records = [
      { id: "a", name: "Top", parentDestinationId: null },
      { id: "b", name: "Also Top", parentDestinationId: null },
    ];
    expect(findOrphanChildren(records)).toHaveLength(0);
  });

  it("returns the orphan's name for human-readable reporting", () => {
    const records = [
      { id: "x", name: "Lost District", parentDestinationId: "ghost-region" },
    ];
    const orphans = findOrphanChildren(records);
    expect(orphans[0].name).toBe("Lost District");
  });
});
