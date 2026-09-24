import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  const data = JSON.parse(fs.readFileSync('DUPLICATE-DESTINATIONS-REPORT.json', 'utf-8'));
  
  console.log(`Starting merge for ${data.length} sets...`);
  
  for (const set of data) {
    const canonicalId = set.canonical.id;
    
    for (const dup of set.duplicates) {
      console.log(`Merging ${dup.name} (${dup.id}) -> ${set.canonical.name} (${canonicalId})`);
      
      // Update Places
      await prisma.place.updateMany({
        where: { destinationId: dup.id },
        data: { destinationId: canonicalId }
      });
      
      // Update Images
      await prisma.image.updateMany({
        where: { destinationId: dup.id },
        data: { destinationId: canonicalId }
      });
      
      // Update Aliases (ignoring conflicts, wait updateMany might fail on unique constraint?
      // DestinationAlias unique constraint is on `alias`.
      // Let's get existing aliases of canonical
      const canonicalAliases = await prisma.destinationAlias.findMany({
        where: { destinationId: canonicalId }
      });
      const canonicalAliasNames = new Set(canonicalAliases.map(a => a.alias.toLowerCase()));
      
      // Also add the duplicate's name as an alias if not exactly canonical name
      if (dup.name.toLowerCase() !== set.canonical.name.toLowerCase() && !canonicalAliasNames.has(dup.name.toLowerCase())) {
         try {
           await prisma.destinationAlias.create({
             data: { alias: dup.name, destinationId: canonicalId }
           });
           canonicalAliasNames.add(dup.name.toLowerCase());
         } catch (e) {
           // ignore duplicate
         }
      }
      
      const dupAliases = await prisma.destinationAlias.findMany({
        where: { destinationId: dup.id }
      });
      
      for (const da of dupAliases) {
        if (!canonicalAliasNames.has(da.alias.toLowerCase())) {
          try {
            await prisma.destinationAlias.update({
              where: { id: da.id },
              data: { destinationId: canonicalId }
            });
            canonicalAliasNames.add(da.alias.toLowerCase());
          } catch (e) {
             await prisma.destinationAlias.delete({ where: { id: da.id } });
          }
        } else {
           // delete it since canonical already has it
           await prisma.destinationAlias.delete({ where: { id: da.id } });
        }
      }
      
      // Re-assign favorite destinations
      const favs = await prisma.favoriteDestination.findMany({
        where: { destinationId: dup.id }
      });
      
      for (const fav of favs) {
        try {
          await prisma.favoriteDestination.update({
            where: { id: fav.id },
            data: { destinationId: canonicalId }
          });
        } catch (e) {
           await prisma.favoriteDestination.delete({ where: { id: fav.id } });
        }
      }
      
      // Re-assign trips
      const trips = await prisma.trip.findMany({
        where: { destinationId: dup.id }
      });
      
      for (const trip of trips) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { destinationId: canonicalId }
        });
      }
      
      // Delete the duplicate
      await prisma.travelDestination.delete({
        where: { id: dup.id }
      });
    }
  }
  
  console.log('Merge complete!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
