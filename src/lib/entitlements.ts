import { prisma } from "./db";

const FREE_TRIP_GENERATIONS = 3;

export type EntitlementStatus = {
  canGenerate: boolean;
  used: number;
  limit: number;
  reason?: string;
};

export async function checkGenerationEntitlement(userId: string): Promise<EntitlementStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tripGenerations: true },
  });

  if (!user) {
    return { canGenerate: false, used: 0, limit: FREE_TRIP_GENERATIONS, reason: "User not found" };
  }

  if (user.tripGenerations >= FREE_TRIP_GENERATIONS) {
    return {
      canGenerate: false,
      used: user.tripGenerations,
      limit: FREE_TRIP_GENERATIONS,
      reason: "Free trip generation used. Upgrade coming soon.",
    };
  }

  return {
    canGenerate: true,
    used: user.tripGenerations,
    limit: FREE_TRIP_GENERATIONS,
  };
}
