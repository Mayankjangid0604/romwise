import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const destIds = new Set((await prisma.travelDestination.findMany({ select: { id: true } })).map(d => d.id));
  
  const places = await prisma.place.findMany({ select: { id: true, destinationId: true } });
  const orphanPlaces = places.filter(p => !destIds.has(p.destinationId));
  
  const images = await prisma.image.findMany({ select: { id: true, destinationId: true } });
  const orphanImages = images.filter(i => i.destinationId && !destIds.has(i.destinationId));
  
  const aliases = await prisma.destinationAlias.findMany({ select: { id: true, destinationId: true } });
  const orphanAliases = aliases.filter(a => !destIds.has(a.destinationId));
  
  const favs = await prisma.favoriteDestination.findMany({ select: { id: true, destinationId: true } });
  const orphanFavs = favs.filter(f => !destIds.has(f.destinationId));
  
  const trips = await prisma.trip.findMany({ select: { id: true, destinationId: true } });
  const orphanTrips = trips.filter(t => t.destinationId && !destIds.has(t.destinationId));

  const children = await prisma.travelDestination.findMany({ select: { id: true, parentDestinationId: true } });
  const orphanChildren = children.filter(c => c.parentDestinationId && !destIds.has(c.parentDestinationId));

  console.log('Orphan Places:', orphanPlaces.length);
  console.log('Orphan Images:', orphanImages.length);
  console.log('Orphan Aliases:', orphanAliases.length);
  console.log('Orphan Favs:', orphanFavs.length);
  console.log('Orphan Trips:', orphanTrips.length);
  console.log('Orphan Children:', orphanChildren.length);
}
run().catch(console.error).finally(() => prisma.$disconnect());
