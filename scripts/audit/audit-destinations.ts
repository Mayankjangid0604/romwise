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
  const reports = [];
  
  for (const name of TARGETS) {
    // Find destinations matching name
    const dests = await prisma.travelDestination.findMany({
      where: {
        OR: [
          { name: { contains: name, mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: name, mode: 'insensitive' } } } }
        ]
      },
      include: {
        aliases: true,
        places: true,
        images: true,
        district: true
      }
    });
    
    for (const d of dests) {
      // Itinerary eligible places: Not stay, not transport
      const itineraryPlaces = d.places.filter(p => !['stay', 'transport'].includes(p.category));
      
      const stays = d.places.filter(p => p.category === 'stay').length;
      const food = d.places.filter(p => ['dining', 'restaurant', 'cafe', 'food_court'].includes(p.category)).length;
      const nature = d.places.filter(p => p.category === 'nature').length;
      const history = d.places.filter(p => p.category === 'history').length;
      const culture = d.places.filter(p => p.category === 'culture').length;
      const spiritual = d.places.filter(p => p.category === 'spiritual').length;
      const adventure = d.places.filter(p => p.category === 'adventure').length;
      
      const withAreas = d.places.filter(p => p.area).length;
      const withHours = d.places.filter(p => p.openingTime || p.osmRawHours).length;
      
      let generationReadiness = 'NONE';
      if (itineraryPlaces.length >= 20) generationReadiness = 'STRONG_COVERAGE';
      else if (itineraryPlaces.length >= 10) generationReadiness = 'GOOD_COVERAGE';
      else if (itineraryPlaces.length >= 4) generationReadiness = 'BASIC';
      
      reports.push({
        name: d.name,
        searchedFor: name,
        id: d.id,
        source: d.sourceType,
        sourceRecordId: d.sourceRecordId,
        state: d.state,
        district: d.district?.name || d.districtId,
        coordinates: `${d.lat}, ${d.lng}`,
        aliases: d.aliases.map(a => a.alias).join(', '),
        destinationType: d.destinationType,
        totalPlaces: d.places.length,
        itineraryEligible: itineraryPlaces.length,
        breakdown: { stays, food, nature, history, culture, spiritual, adventure },
        images: d.images.length,
        areas: withAreas,
        openingHoursCoverage: withHours,
        generationReadiness
      });
    }
  }
  
  fs.writeFileSync('DESTINATION-FORENSIC-AUDIT.json', JSON.stringify(reports, null, 2));
  console.log('Forensic audit generated!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
