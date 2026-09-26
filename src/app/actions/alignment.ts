"use server";

import { prisma } from "@/lib/db";
import { requireTripRole } from "@/lib/security";
import { auth } from "@/lib/auth";
import { analyzeGroupAlignment, GroupAlignmentInput } from "@/lib/group-alignment";

export async function getGroupAlignment(tripId: string) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) throw new Error("Unauthorized");
  await requireTripRole(tripId, "viewer");

  // Fetch all members and their preferences
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      groupMembers: {
        include: {
          user: { select: { name: true } },
          travelerPreferences: true,
        }
      }
    }
  });

  if (!trip) throw new Error("Trip not found");

  if (trip.groupMembers.length < 2) {
    return {
      coreTension: "Not enough members for a group alignment analysis.",
      compromiseSuggestion: "Invite more people to see how your preferences align!",
      harmonyScore: 100,
    };
  }

  const travelers: GroupAlignmentInput["travelers"] = trip.groupMembers.map(m => {
    const prefs = m.travelerPreferences;
    
    // Group preferences by category
    const getList = (cat: string) => 
      prefs.filter(p => p.category === cat && p.priority !== "neutral").map(p => p.priority);

    return {
      name: m.user.name || "Traveler",
      pace: (prefs.find(p => p.category === "pace")?.priority as "easy" | "balanced" | "full") || "balanced",
      interests: getList("interests"),
      priorities: getList("priorities"),
      foodPreferences: getList("food_preferences"),
      accessibility: getList("accessibility"),
    };
  });

  return analyzeGroupAlignment({ travelers });
}
