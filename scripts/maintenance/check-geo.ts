import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const dests = await prisma.travelDestination.findMany({
    where: { name: { in: ['Varkala', 'Canacona', 'Kalavoor'] } },
    select: { name: true, state: true }
  });
  console.log(dests);
}
run().catch(console.error).finally(() => prisma.$disconnect());
