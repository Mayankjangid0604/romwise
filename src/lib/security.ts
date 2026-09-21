import { auth } from "./auth";
import { prisma } from "./db";
import { ROLES } from "./roles";
import { redirect } from "next/navigation";

export type TripRole = "creator" | "member" | "viewer";

/**
 * Checks if the user is authenticated. If not, redirects to login.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Determines the role of a user for a specific trip.
 * @returns "creator", "member", "viewer", or null if no access.
 */
export async function getTripRole(tripId: string, userId?: string): Promise<TripRole | null> {
  if (!userId) return null;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { creatorId: true },
  });

  if (!trip) return null;

  // The trip creator has full access
  if (trip.creatorId === userId) {
    return "creator";
  }

  // Check if they are a group member
  const groupMember = await prisma.groupMember.findUnique({
    where: { userId_tripId: { userId, tripId } },
    select: { role: true },
  });

  if (groupMember) {
    return groupMember.role as TripRole;
  }

  return null;
}

/**
 * Ensures the user has at least the required role for the trip.
 * Hierarchy: creator > member > viewer
 * If the user does not have access, throws an error or returns false.
 */
export async function hasTripRole(tripId: string, minRole: TripRole): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const role = await getTripRole(tripId, session.user.id);
  if (!role) return false;

  if (minRole === "creator") return role === "creator";
  if (minRole === "member") return role === "creator" || role === "member";
  return true; // viewer requires any role
}

/**
 * Server action helper that throws if the user doesn't have the required role.
 */
export async function requireTripRole(tripId: string, minRole: TripRole) {
  const hasRole = await hasTripRole(tripId, minRole);
  if (!hasRole) {
    throw new Error(`Unauthorized: Requires ${minRole} role for trip ${tripId}`);
  }
}
