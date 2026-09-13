import { prisma } from "./db";

export async function findDestination(query: string) {
  const normalized = query.trim();
  if (!normalized) return null;

  const exact = await prisma.destination.findFirst({
    where: {
      name: { equals: normalized, mode: "insensitive" },
    },
  });
  if (exact) return exact;

  const partial = await prisma.destination.findFirst({
    where: {
      name: { contains: normalized, mode: "insensitive" },
    },
  });
  return partial;
}

export async function searchDestinations(query: string, limit = 10) {
  if (!query.trim()) return [];

  return prisma.destination.findMany({
    where: {
      name: { contains: query.trim(), mode: "insensitive" },
    },
    orderBy: [
      { population: "desc" },
    ],
    take: limit,
  });
}

export async function getDestinationCoordinates(destinationName: string): Promise<{ lat: number; lng: number } | null> {
  const dest = await findDestination(destinationName);
  if (!dest) return null;
  return { lat: dest.lat, lng: dest.lng };
}
