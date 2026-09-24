import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const tD = await prisma.travelDestination.count();
  const dA = await prisma.destinationAlias.count();
  const p = await prisma.place.count();
  
  const catGroup = await prisma.place.groupBy({
    by: ['category'],
    _count: { category: true }
  });

  const excludedCats = ['stay', 'transport'];
  const eligibleP = await prisma.place.count({
    where: { category: { notIn: excludedCats }, dataStatus: { notIn: ['deprecated', 'REJECTED'] } }
  });

  console.log(`TravelDestination: ${tD}`);
  console.log(`DestinationAlias: ${dA}`);
  console.log(`Place: ${p}`);
  console.log(`Itinerary eligible Places: ${eligibleP}`);
  console.log(`Categories:`, JSON.stringify(catGroup, null, 2));

  await prisma.$disconnect();
}
run().catch(console.error);
