import { prisma } from "./db";
import { PREFERENCE_CATEGORIES, isValidPreferenceCategory } from "./categories";

export { PREFERENCE_CATEGORIES as CATEGORIES, isValidPreferenceCategory as isValidCategory };
export type { PreferenceCategory as Category } from "./categories";

export const PRIORITIES = [
  "must-have",
  "very-important",
  "preferred",
  "nice-to-have",
  "avoid",
  "never",
] as const;

export type Priority = (typeof PRIORITIES)[number];

export function isValidPriority(value: string): value is Priority {
  return PRIORITIES.includes(value as Priority);
}

export async function getPreferencesForTrip(tripId: string) {
  const members = await prisma.groupMember.findMany({
    where: { tripId },
    include: { travelerPreferences: true },
  });

  return members.map((m) => ({
    userId: m.userId,
    role: m.role,
    preferences: m.travelerPreferences.map((p) => ({
      category: p.category,
      priority: p.priority as Priority,
    })),
  }));
}

export async function setPreference(
  groupMemberId: string,
  category: string,
  priority: Priority,
) {
  if (!isValidPreferenceCategory(category)) {
    throw new Error(`Invalid category: ${category}`);
  }
  return prisma.travelerPreference.upsert({
    where: { groupMemberId_category: { groupMemberId, category } },
    create: { groupMemberId, category, priority },
    update: { priority },
  });
}

export async function removePreference(groupMemberId: string, category: string) {
  return prisma.travelerPreference.deleteMany({
    where: { groupMemberId, category },
  });
}
