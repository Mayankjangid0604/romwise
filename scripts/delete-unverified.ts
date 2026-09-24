import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const deleted = await prisma.place.deleteMany({
    where: {
      sourceType: 'OPENSTREETMAP',
      sourceRecordId: { startsWith: 'manual-osm-' }
    }
  });
  console.log('Deleted records:', deleted.count);
}
run().catch(console.error).finally(() => prisma.$disconnect());
