import { prisma } from "./db";

export type HierarchyNode = {
  id: string;
  name: string;
  slug: string;
  parentDestinationId: string | null;
};

/**
 * Return the given destination ID plus all descendant destination IDs.
 *
 * Uses BFS so depth is bounded. The returned set always includes the root.
 * For a leaf destination (no children), returns [destinationId].
 *
 * Cross-destination contamination is impossible by design: the DB relation
 * only connects parent → child, so BFS stays within the same subtree.
 *
 * Guards: max depth of 8 levels to prevent runaway queries if the DB ever
 * contains a cycle that the validator failed to catch.
 */
export async function getDestinationDescendants(
  destinationId: string,
): Promise<string[]> {
  const seen = new Set<string>([destinationId]);
  const queue = [destinationId];
  const MAX_DEPTH = 8;
  let depth = 0;

  while (queue.length > 0 && depth < MAX_DEPTH) {
    const currentBatch = queue.splice(0);
    depth++;

    const children = await prisma.travelDestination.findMany({
      where: { parentDestinationId: { in: currentBatch } },
      select: { id: true },
    });

    for (const child of children) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return Array.from(seen);
}

/**
 * Detect cycles in the destination hierarchy from a flat list of records.
 *
 * Returns every (id, parentId) pair that participates in a cycle.
 * An empty array means no cycles.
 */
export function detectHierarchyCycles(
  records: { id: string; parentDestinationId: string | null }[],
): { id: string; parentId: string }[] {
  const parentOf = new Map<string, string>();
  for (const r of records) {
    if (r.parentDestinationId) {
      parentOf.set(r.id, r.parentDestinationId);
    }
  }

  const cycleMembers: { id: string; parentId: string }[] = [];

  for (const startId of parentOf.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = startId;

    while (current && parentOf.has(current)) {
      if (visited.has(current)) {
        // Cycle confirmed — record this edge
        cycleMembers.push({ id: current, parentId: parentOf.get(current)! });
        break;
      }
      visited.add(current);
      current = parentOf.get(current);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return cycleMembers.filter((c) => {
    const key = `${c.id}:${c.parentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Return child destination IDs whose parentDestinationId points to an ID
 * not present in the known destination set (orphan children).
 */
export function findOrphanChildren(
  records: { id: string; name: string; parentDestinationId: string | null }[],
): { id: string; name: string; missingParentId: string }[] {
  const allIds = new Set(records.map((r) => r.id));
  return records
    .filter((r) => r.parentDestinationId && !allIds.has(r.parentDestinationId))
    .map((r) => ({
      id: r.id,
      name: r.name,
      missingParentId: r.parentDestinationId!,
    }));
}
