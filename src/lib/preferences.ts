import { prisma } from "./db";

export const CATEGORIES = [
  "dining",
  "sightseeing",
  "adventure",
  "culture",
  "shopping",
  "relaxation",
  "nightlife",
  "nature",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = [
  "must-have",
  "very-important",
  "preferred",
  "nice-to-have",
  "avoid",
  "never",
] as const;

export type Priority = (typeof PRIORITIES)[number];

export function isValidCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

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
      category: p.category as Category,
      priority: p.priority as Priority,
    })),
  }));
}

export async function setPreference(
  groupMemberId: string,
  category: Category,
  priority: Priority,
) {
  return prisma.travelerPreference.upsert({
    where: {
      groupMemberId_category: { groupMemberId, category },
    },
    create: { groupMemberId, category, priority },
    update: { priority },
  });
}

export async function removePreference(groupMemberId: string, category: Category) {
  return prisma.travelerPreference.deleteMany({
    where: { groupMemberId, category },
  });
}
