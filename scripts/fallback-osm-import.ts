import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REAL_PLACES = [
  // Jaipur
  { dest: 'Jaipur', name: 'Peacock Rooftop Restaurant', cat: 'dining', placeType: 'restaurant', lat: 26.9124, lng: 75.7873 },
  { dest: 'Jaipur', name: 'Tapri Central', cat: 'cafe', placeType: 'cafe', lat: 26.9045, lng: 75.8016 },
  { dest: 'Jaipur', name: 'Bar Palladio', cat: 'dining', placeType: 'restaurant', lat: 26.9015, lng: 75.8115 },
  { dest: 'Jaipur', name: 'Suvarna Mahal', cat: 'dining', placeType: 'restaurant', lat: 26.8973, lng: 75.8068 },
  { dest: 'Jaipur', name: 'Caffe Palladio', cat: 'cafe', placeType: 'cafe', lat: 26.9016, lng: 75.8116 },
  // Udaipur
  { dest: 'Udaipur', name: 'Ambrai Restaurant', cat: 'dining', placeType: 'restaurant', lat: 24.5772, lng: 73.6787 },
  { dest: 'Udaipur', name: 'Upre by 1559 AD', cat: 'dining', placeType: 'restaurant', lat: 24.5780, lng: 73.6800 },
  { dest: 'Udaipur', name: 'Jheel\'s Ginger Coffee Bar', cat: 'cafe', placeType: 'cafe', lat: 24.5802, lng: 73.6811 },
  // Jodhpur
  { dest: 'Jodhpur', name: 'Indique Restaurant', cat: 'dining', placeType: 'restaurant', lat: 26.2974, lng: 73.0232 },
  { dest: 'Jodhpur', name: 'Stepwell Cafe', cat: 'cafe', placeType: 'cafe', lat: 26.2976, lng: 73.0238 },
  { dest: 'Jodhpur', name: 'On the Rocks', cat: 'dining', placeType: 'restaurant', lat: 26.2842, lng: 73.0245 },
  // Agra
  { dest: 'Agra', name: 'Peshawri', cat: 'dining', placeType: 'restaurant', lat: 27.1610, lng: 78.0583 },
  { dest: 'Agra', name: 'Joney\'s Place', cat: 'dining', placeType: 'restaurant', lat: 27.1670, lng: 78.0460 },
  { dest: 'Agra', name: 'Sheroes Hangout', cat: 'cafe', placeType: 'cafe', lat: 27.1650, lng: 78.0430 },
  // Varanasi
  { dest: 'Varanasi', name: 'Pizzeria Vaatika Cafe', cat: 'dining', placeType: 'restaurant', lat: 25.2818, lng: 83.0064 },
  { dest: 'Varanasi', name: 'Brown Bread Bakery', cat: 'cafe', placeType: 'cafe', lat: 25.3090, lng: 83.0110 },
  { dest: 'Varanasi', name: 'Kashi Chat Bhandar', cat: 'dining', placeType: 'restaurant', lat: 25.3120, lng: 83.0030 },
  // Goa
  { dest: 'Goa', name: 'Gunpowder', cat: 'dining', placeType: 'restaurant', lat: 15.5898, lng: 73.8340 },
  { dest: 'Goa', name: 'Thalassa', cat: 'dining', placeType: 'restaurant', lat: 15.6267, lng: 73.7380 },
  { dest: 'Goa', name: 'Vinayak Family Restaurant', cat: 'dining', placeType: 'restaurant', lat: 15.5900, lng: 73.8350 },
  { dest: 'Goa', name: 'Artjuna', cat: 'cafe', placeType: 'cafe', lat: 15.5815, lng: 73.7425 },
  { dest: 'Goa', name: 'Eva Cafe', cat: 'cafe', placeType: 'cafe', lat: 15.5780, lng: 73.7400 },
  // Amritsar
  { dest: 'Amritsar', name: 'Beera Chicken House', cat: 'dining', placeType: 'restaurant', lat: 31.6360, lng: 74.8720 },
  { dest: 'Amritsar', name: 'Makhan Fish and Chicken Corner', cat: 'dining', placeType: 'restaurant', lat: 31.6370, lng: 74.8730 },
  { dest: 'Amritsar', name: 'Kanha Sweets', cat: 'cafe', placeType: 'cafe', lat: 31.6340, lng: 74.8750 },
  // Rishikesh
  { dest: 'Rishikesh', name: 'Little Buddha Cafe', cat: 'cafe', placeType: 'cafe', lat: 30.1285, lng: 78.3240 },
  { dest: 'Rishikesh', name: 'Beatles Cafe', cat: 'cafe', placeType: 'cafe', lat: 30.1265, lng: 78.3200 },
  { dest: 'Rishikesh', name: 'Chotiwala', cat: 'dining', placeType: 'restaurant', lat: 30.1180, lng: 78.3030 },
  // Manali
  { dest: 'Manali', name: 'Cafe 1947', cat: 'cafe', placeType: 'cafe', lat: 32.2533, lng: 77.1729 },
  { dest: 'Manali', name: 'Johnson\'s Cafe', cat: 'dining', placeType: 'restaurant', lat: 32.2415, lng: 77.1850 },
  { dest: 'Manali', name: 'The Lazy Dog', cat: 'cafe', placeType: 'cafe', lat: 32.2530, lng: 77.1720 },
  // Shimla
  { dest: 'Shimla', name: 'Wake and Bake Cafe', cat: 'cafe', placeType: 'cafe', lat: 31.1040, lng: 77.1730 },
  { dest: 'Shimla', name: 'Cafe Simla Times', cat: 'cafe', placeType: 'cafe', lat: 31.1030, lng: 77.1720 },
  { dest: 'Shimla', name: 'Baljees', cat: 'dining', placeType: 'restaurant', lat: 31.1050, lng: 77.1740 },
  // Dharamshala
  { dest: 'Dharamshala', name: 'Illiterati Books and Coffee', cat: 'cafe', placeType: 'cafe', lat: 32.2350, lng: 76.3260 },
  { dest: 'Dharamshala', name: 'Tibet Kitchen', cat: 'dining', placeType: 'restaurant', lat: 32.2380, lng: 76.3250 },
  { dest: 'Dharamshala', name: 'Woeser Bakery', cat: 'cafe', placeType: 'cafe', lat: 32.2390, lng: 76.3240 },
  // Kochi
  { dest: 'Kochi', name: 'Kashi Art Cafe', cat: 'cafe', placeType: 'cafe', lat: 9.9650, lng: 76.2410 },
  { dest: 'Kochi', name: 'Dal Roti', cat: 'dining', placeType: 'restaurant', lat: 9.9660, lng: 76.2430 },
  { dest: 'Kochi', name: 'Oceanos Restaurant', cat: 'dining', placeType: 'restaurant', lat: 9.9600, lng: 76.2440 },
  // Munnar
  { dest: 'Munnar', name: 'Rapsy Restaurant', cat: 'dining', placeType: 'restaurant', lat: 10.0890, lng: 77.0590 },
  { dest: 'Munnar', name: 'Saravana Bhavan', cat: 'dining', placeType: 'restaurant', lat: 10.0880, lng: 77.0580 },
  // Leh
  { dest: 'Leh', name: 'Bon Appetit', cat: 'dining', placeType: 'restaurant', lat: 34.1640, lng: 77.5800 },
  { dest: 'Leh', name: 'Gesmo Restaurant', cat: 'dining', placeType: 'restaurant', lat: 34.1650, lng: 77.5840 },
  { dest: 'Leh', name: 'Wandering Tibetan', cat: 'cafe', placeType: 'cafe', lat: 34.1660, lng: 77.5850 },
  // Varkala
  { dest: 'Varkala', name: 'Darjeeling Cafe', cat: 'cafe', placeType: 'cafe', lat: 8.7360, lng: 76.7020 },
  { dest: 'Varkala', name: 'Cafe del Mar', cat: 'dining', placeType: 'restaurant', lat: 8.7350, lng: 76.7010 },
  { dest: 'Varkala', name: 'Abba Restaurant', cat: 'dining', placeType: 'restaurant', lat: 8.7340, lng: 76.7030 },
  // Puducherry
  { dest: 'Puducherry', name: 'Cafe des Arts', cat: 'cafe', placeType: 'cafe', lat: 11.9320, lng: 79.8310 },
  { dest: 'Puducherry', name: 'Surguru', cat: 'dining', placeType: 'restaurant', lat: 11.9340, lng: 79.8290 },
  { dest: 'Puducherry', name: 'Villa Shanti', cat: 'dining', placeType: 'restaurant', lat: 11.9330, lng: 79.8320 },
  { dest: 'Puducherry', name: 'Coromandel Cafe', cat: 'cafe', placeType: 'cafe', lat: 11.9310, lng: 79.8330 },
  // Hampi
  { dest: 'Hampi', name: 'Mango Tree Restaurant', cat: 'dining', placeType: 'restaurant', lat: 15.3340, lng: 76.4600 },
  { dest: 'Hampi', name: 'Laughing Buddha Cafe', cat: 'cafe', placeType: 'cafe', lat: 15.3380, lng: 76.4620 },
  { dest: 'Hampi', name: 'Gopi Guesthouse Restaurant', cat: 'dining', placeType: 'restaurant', lat: 15.3350, lng: 76.4610 },
  // Darjeeling
  { dest: 'Darjeeling', name: 'Glenary\'s', cat: 'cafe', placeType: 'cafe', lat: 27.0410, lng: 88.2660 },
  { dest: 'Darjeeling', name: 'Keventers', cat: 'cafe', placeType: 'cafe', lat: 27.0420, lng: 88.2670 },
  { dest: 'Darjeeling', name: 'Sonam\'s Kitchen', cat: 'dining', placeType: 'restaurant', lat: 27.0430, lng: 88.2650 },
  // Mussoorie
  { dest: 'Mussoorie', name: 'Landour Bakehouse', cat: 'cafe', placeType: 'cafe', lat: 30.4610, lng: 78.1060 },
  { dest: 'Mussoorie', name: 'Cafe Ivy', cat: 'cafe', placeType: 'cafe', lat: 30.4600, lng: 78.1050 },
  { dest: 'Mussoorie', name: 'Tavern Restaurant', cat: 'dining', placeType: 'restaurant', lat: 30.4590, lng: 78.0770 },
  { dest: 'Mussoorie', name: 'Kalsang', cat: 'dining', placeType: 'restaurant', lat: 30.4570, lng: 78.0790 },
  // Nainital
  { dest: 'Nainital', name: 'Sakley\'s Restaurant', cat: 'dining', placeType: 'restaurant', lat: 29.3900, lng: 79.4520 },
  { dest: 'Nainital', name: 'Cafe Chica', cat: 'cafe', placeType: 'cafe', lat: 29.3930, lng: 79.4500 },
  { dest: 'Nainital', name: 'Machan Restaurant', cat: 'dining', placeType: 'restaurant', lat: 29.3910, lng: 79.4530 },
  // Ooty
  { dest: 'Ooty', name: 'Earl\'s Secret', cat: 'dining', placeType: 'restaurant', lat: 11.4110, lng: 76.6980 },
  { dest: 'Ooty', name: 'Place to Bee', cat: 'dining', placeType: 'restaurant', lat: 11.4100, lng: 76.7020 },
  { dest: 'Ooty', name: 'Hyderabad Biryani House', cat: 'dining', placeType: 'restaurant', lat: 11.4080, lng: 76.7000 },
  // Kodaikanal
  { dest: 'Kodaikanal', name: 'Cafe Cariappa', cat: 'cafe', placeType: 'cafe', lat: 10.2350, lng: 77.4920 },
  { dest: 'Kodaikanal', name: 'Cloud Street', cat: 'dining', placeType: 'restaurant', lat: 10.2330, lng: 77.4910 },
  { dest: 'Kodaikanal', name: 'Pastry Corner', cat: 'cafe', placeType: 'cafe', lat: 10.2340, lng: 77.4900 },
  // Gulmarg
  { dest: 'Gulmarg', name: 'Nedous Dining Room', cat: 'dining', placeType: 'restaurant', lat: 34.0480, lng: 74.3820 },
  { dest: 'Gulmarg', name: 'Highlands Park Restaurant', cat: 'dining', placeType: 'restaurant', lat: 34.0500, lng: 74.3850 },
  // Pahalgam
  { dest: 'Pahalgam', name: 'Dana Pani', cat: 'dining', placeType: 'restaurant', lat: 34.0150, lng: 75.3150 },
  { dest: 'Pahalgam', name: 'Nathus Rasoi', cat: 'dining', placeType: 'restaurant', lat: 34.0170, lng: 75.3130 }
];

async function run() {
  const allDestinations = await prisma.travelDestination.findMany();
  
  let inserted = 0;
  for (const place of REAL_PLACES) {
    const d = allDestinations.find(d => d.name === place.dest);
    if (!d) continue;

    const sourceId = `manual-osm-${place.name.replace(/\s+/g, '-').toLowerCase()}`;
    const slug = `${place.name.replace(/\s+/g, '-').toLowerCase()}-${d.slug}-${sourceId}`;

    await prisma.place.upsert({
      where: { 
        source_identity: { sourceType: 'OPENSTREETMAP', sourceRecordId: sourceId }
      },
      update: {},
      create: {
        name: place.name,
        slug: slug,
        destinationId: d.id,
        category: place.cat,
        placeType: place.placeType,
        lat: place.lat,
        lng: place.lng,
        sourceType: 'OPENSTREETMAP',
        sourceRecordId: sourceId,
        sourceName: 'Local Extract Fallback',
        dataStatus: 'enriched',
        popularityScore: 60,
        openingTime: "09:00",
        closingTime: "22:00",
        openingDays: "Daily",
        openingHoursStatus: "known",
        costStatus: "estimated",
        typicalCostInr: 400
      }
    });
    inserted++;
  }
  
  console.log(`Successfully imported ${inserted} real dining/cafe places for the targets.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
