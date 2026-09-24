import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function run() {
  const dests = await prisma.travelDestination.findMany({
    include: {
      _count: { select: { places: true } }
    }
  });
  
  const duplicates = [];
  const processed = new Set();
  
  // Sort by total places descending, so the canonical is usually the one with more places or curated
  // Actually, prefer curated/wikipedia over geonames/wikidata
  const score = (d: any) => {
    let s = d._count.places;
    if (d.sourceType === 'curated') s += 10000;
    if (d.sourceType === 'wikipedia_geosearch') s += 5000;
    return s;
  };
  
  dests.sort((a, b) => score(b) - score(a));
  
  for (let i = 0; i < dests.length; i++) {
    const d1 = dests[i];
    if (processed.has(d1.id)) continue;
    
    const similar = [];
    
    for (let j = i + 1; j < dests.length; j++) {
      const d2 = dests[j];
      if (processed.has(d2.id)) continue;
      
      const sameName = d1.name.toLowerCase() === d2.name.toLowerCase();
      const sameState = d1.state === d2.state;
      const distance = getDistance(d1.lat, d1.lng, d2.lat, d2.lng);
      
      if ((sameName && sameState) || distance < 10) {
        // If distance < 10km and name is similar, or exact name match in same state
        const nameSimilarity = d1.name.toLowerCase() === d2.name.toLowerCase() || 
                               d1.name.toLowerCase().includes(d2.name.toLowerCase()) || 
                               d2.name.toLowerCase().includes(d1.name.toLowerCase());
                               
        if (sameName || (distance < 10 && nameSimilarity)) {
           similar.push(d2);
           processed.add(d2.id);
        }
      }
    }
    
    if (similar.length > 0) {
      duplicates.push({
        canonical: {
          id: d1.id,
          name: d1.name,
          state: d1.state,
          source: d1.sourceType,
          places: d1._count.places
        },
        duplicates: similar.map(d => ({
          id: d.id,
          name: d.name,
          state: d.state,
          source: d.sourceType,
          places: d._count.places,
          distanceKm: getDistance(d1.lat, d1.lng, d.lat, d.lng).toFixed(2)
        }))
      });
    }
  }
  
  fs.writeFileSync('DUPLICATE-DESTINATIONS-REPORT.json', JSON.stringify(duplicates, null, 2));
  console.log(`Found ${duplicates.length} sets of duplicates.`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
