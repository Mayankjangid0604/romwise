import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.place.groupBy({
    by: ['category'],
    _count: { category: true },
    orderBy: { _count: { category: 'desc' } }
  });
  console.log("Categories:", categories);
  
  const vibes = await prisma.place.groupBy({
    by: ['vibes'],
    _count: { vibes: true },
    orderBy: { _count: { vibes: 'desc' } }
  });
  console.log("Vibes:", vibes.slice(0, 10));

  const placeTypes = await prisma.place.groupBy({
    by: ['placeType'],
    _count: { placeType: true },
    orderBy: { _count: { placeType: 'desc' } }
  });
  console.log("PlaceTypes:", placeTypes.slice(0, 20));
}

main().catch(console.error).finally(() => prisma.$disconnect());
