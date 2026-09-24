import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  const destCount = await prisma.travelDestination.count();
  const aliasCount = await prisma.destinationAlias.count();
  const placeCount = await prisma.place.count();
  const imageCount = await prisma.image.count();

  const categories = await prisma.place.groupBy({
    by: ['category'],
    _count: { category: true }
  });

  const sources = await prisma.place.groupBy({
    by: ['sourceType'],
    _count: { sourceType: true }
  });

  const withCoords = await prisma.place.count({ where: { lat: { not: 0 }, lng: { not: 0 } } });
  const withArea = await prisma.place.count({ where: { area: { not: null } } });
  const withHours = await prisma.place.count({ where: { OR: [{ openingTime: { not: null } }, { osmRawHours: { not: null } }] } });
  const withAddress = await prisma.place.count({ where: { address: { not: null } } });
  const withWebsite = await prisma.place.count({ where: { website: { not: null } } });
  const withPhone = await prisma.place.count({ where: { phone: { not: null } } });
  const withWheelchair = await prisma.place.count({ where: { wheelchair: { not: null } } });
  const withCost = await prisma.place.count({ where: { typicalCostInr: { not: null } } });
  const withDuration = await prisma.place.count({ where: { durationMinutes: { not: null } } });
  const withImage = await prisma.place.count({ where: { images: { some: {} } } });

  const data = {
    tables: {
      TravelDestination: destCount,
      DestinationAlias: aliasCount,
      Place: placeCount,
      Image: imageCount
    },
    categories: categories.reduce((acc, curr) => {
      acc[curr.category || 'null'] = curr._count.category;
      return acc;
    }, {} as Record<string, number>),
    sources: sources.reduce((acc, curr) => {
      acc[curr.sourceType] = curr._count.sourceType;
      return acc;
    }, {} as Record<string, number>),
    fields: {
      coordinates: withCoords,
      area: withArea,
      openingHours: withHours,
      address: withAddress,
      website: withWebsite,
      phone: withPhone,
      accessibility: withWheelchair,
      typicalCost: withCost,
      duration: withDuration,
      image: withImage
    }
  };

  fs.writeFileSync('INDIA-DATA-DEPTH-BEFORE.json', JSON.stringify(data, null, 2));
  console.log('Done!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
