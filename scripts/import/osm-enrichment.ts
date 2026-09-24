import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const TARGETS = [
  'Manali', 'Mussoorie', 'Nainital', 'Munnar', 'Shimla', 'Dharamshala',
  'Leh', 'Gulmarg', 'Pahalgam', 'Darjeeling', 'Ooty', 'Kodaikanal',
  'Jaipur', 'Udaipur', 'Jodhpur', 'Agra', 'Varanasi', 'Goa', 'Varkala',
  'Puducherry', 'Rishikesh', 'Amritsar', 'Hampi', 'Kochi'
];

async function run() {
  const dests = await prisma.travelDestination.findMany({
    where: {
      name: { in: TARGETS }
    }
  });

  // Deduplicate just in case
  const uniqueDests = [];
  const seen = new Set();
  for (const d of dests) {
    if (!seen.has(d.name)) {
      uniqueDests.push(d);
      seen.add(d.name);
    }
  }

  for (const dest of uniqueDests) {
    console.log(`Processing OSM for ${dest.name}...`);
    const lat = dest.lat;
    const lon = dest.lng;
    
    // bounding box ~ 10km radius
    // 1 deg lat ~ 111km, so 0.1 ~ 11km
    const latOffset = 0.1;
    const lonOffset = 0.1;
    const s = lat - latOffset;
    const n = lat + latOffset;
    const w = lon - lonOffset;
    const e = lon + lonOffset;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|food_court"](${s},${w},${n},${e});
        node["tourism"~"attraction|viewpoint|museum|gallery"](${s},${w},${n},${e});
        node["historic"](${s},${w},${n},${e});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      if (!response.ok) {
        console.error(`Failed to fetch for ${dest.name}: ${response.statusText}`);
        // Backoff and continue
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const data = await response.json();
      const elements = data.elements || [];
      
      let inserted = 0;
      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue; // Skip unnamed
        
        let category = 'sightseeing';
        if (el.tags.amenity === 'restaurant') category = 'restaurant';
        if (el.tags.amenity === 'cafe') category = 'cafe';
        if (el.tags.amenity === 'food_court') category = 'dining';
        if (el.tags.tourism === 'viewpoint') category = 'nature';
        if (el.tags.historic) category = 'history';
        if (el.tags.tourism === 'museum') category = 'culture';

        const placeId = `osm-${el.id}`;
        
        // Upsert place
        await prisma.place.upsert({
          where: {
            source_identity: {
              sourceType: 'OSM',
              sourceRecordId: placeId
            }
          },
          update: {
            openingTime: el.tags.opening_hours || null,
            osmRawHours: el.tags.opening_hours || null,
            address: el.tags['addr:full'] || el.tags['addr:street'] || null,
            phone: el.tags.phone || el.tags['contact:phone'] || null,
            website: el.tags.website || el.tags['contact:website'] || null,
            wheelchair: el.tags.wheelchair || null,
            cuisine: el.tags.cuisine || null,
          },
          create: {
            name: el.tags.name,
            slug: `${el.tags.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${el.id}`,
            destinationId: dest.id,
            category,
            lat: el.lat,
            lng: el.lon,
            sourceType: 'OSM',
            sourceRecordId: placeId,
            sourceName: 'OpenStreetMap',
            dataStatus: 'enriched',
            openingTime: el.tags.opening_hours || null,
            osmRawHours: el.tags.opening_hours || null,
            address: el.tags['addr:full'] || el.tags['addr:street'] || null,
            phone: el.tags.phone || el.tags['contact:phone'] || null,
            website: el.tags.website || el.tags['contact:website'] || null,
            wheelchair: el.tags.wheelchair || null,
            cuisine: el.tags.cuisine || null,
            popularityScore: 40 // Default for OSM
          }
        });
        inserted++;
      }

      console.log(`Saved ${inserted} new/updated places for ${dest.name}`);
      
      // Strict rate limit backoff
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Error for ${dest.name}`, err);
    }
  }

  console.log('OSM enrichment complete!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
