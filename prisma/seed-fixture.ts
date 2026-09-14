/**
 * DEV FIXTURE — NOT REAL PRODUCTION DATA
 *
 * Populates TravelDestination + Place records for development and automated testing.
 * All records are marked: sourceType = "fixture", dataStatus = "seed"
 *
 * Places use real-world approximate coordinates and costs sourced from public
 * knowledge, but this data has NOT been verified against official sources.
 * Do NOT use this fixture as authoritative travel information.
 *
 * Destinations included:
 *   - Jaipur, Rajasthan
 *   - Rishikesh, Uttarakhand
 *   - Goa, Goa
 *
 * Run: npm run db:seed:fixture
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Fixture data ───────────────────────────────────────────────────────────────

const DESTINATIONS = [
  {
    name: "Jaipur",
    slug: "jaipur",
    state: "Rajasthan",
    lat: 26.9124,
    lng: 75.7873,
    description: "The Pink City — famous for its Rajput-era architecture, forts, and bazaars.",
    aliases: ["Pink City"],
    places: [
      {
        name: "Hawa Mahal",
        slug: "hawa-mahal-jaipur",
        category: "sightseeing",
        area: "Old City",
        lat: 26.9239,
        lng: 75.8267,
        typicalCostInr: 200,
        durationMinutes: 60,
        openingTime: "09:00",
        closingTime: "17:00",
        bestSeason: "Oct-Mar",
        popularityScore: 95,
        description: "Iconic five-storey pink sandstone palace with 953 windows.",
        vibes: "heritage, photography, architecture",
      },
      {
        name: "Amber Fort",
        slug: "amber-fort-jaipur",
        category: "history",
        area: "Amer",
        lat: 26.9855,
        lng: 75.8513,
        typicalCostInr: 500,
        durationMinutes: 120,
        openingTime: "08:00",
        closingTime: "17:30",
        bestSeason: "Oct-Mar",
        popularityScore: 98,
        description: "Magnificent hilltop fort with Rajput and Mughal architecture, elephant rides, and panoramic views.",
        vibes: "heritage, history, adventure",
      },
      {
        name: "City Palace",
        slug: "city-palace-jaipur",
        category: "culture",
        area: "Old City",
        lat: 26.9258,
        lng: 75.8237,
        typicalCostInr: 700,
        durationMinutes: 90,
        openingTime: "09:30",
        closingTime: "17:00",
        bestSeason: "Oct-Mar",
        popularityScore: 92,
        description: "Royal palace complex housing museums, courtyards, and the Maharaja's ceremonial halls.",
        vibes: "culture, heritage, history",
      },
      {
        name: "Jantar Mantar",
        slug: "jantar-mantar-jaipur",
        category: "history",
        area: "Old City",
        lat: 26.9254,
        lng: 75.8237,
        typicalCostInr: 200,
        durationMinutes: 60,
        openingTime: "09:00",
        closingTime: "16:30",
        bestSeason: "Oct-Mar",
        popularityScore: 80,
        description: "UNESCO World Heritage astronomical observatory built in 1734 with 20 large instruments.",
        vibes: "history, science, architecture",
      },
      {
        name: "Johari Bazaar",
        slug: "johari-bazaar-jaipur",
        category: "shopping",
        area: "Old City",
        lat: 26.9225,
        lng: 75.8202,
        typicalCostInr: 0,
        durationMinutes: 90,
        openingTime: "10:00",
        closingTime: "20:00",
        bestSeason: "year-round",
        popularityScore: 85,
        description: "Bustling jewellery market in the heart of the old city, famous for gems and silver.",
        vibes: "shopping, local_experience",
      },
      {
        name: "Chokhi Dhani",
        slug: "chokhi-dhani-jaipur",
        category: "dining",
        area: "Tonk Road",
        lat: 26.7951,
        lng: 75.8344,
        typicalCostInr: 1100,
        durationMinutes: 180,
        openingTime: "17:00",
        closingTime: "23:00",
        bestSeason: "Oct-Mar",
        popularityScore: 88,
        description: "Rajasthani village resort offering traditional food, folk music, dance, and cultural activities.",
        vibes: "dining, culture, local_experience",
      },
      {
        name: "Albert Hall Museum",
        slug: "albert-hall-museum-jaipur",
        category: "culture",
        area: "Ram Niwas Garden",
        lat: 26.9076,
        lng: 75.8219,
        typicalCostInr: 150,
        durationMinutes: 75,
        openingTime: "10:00",
        closingTime: "17:00",
        bestSeason: "Oct-Mar",
        popularityScore: 78,
        description: "Oldest museum in Rajasthan featuring Egyptian mummies, carpets, and artefacts.",
        vibes: "culture, history, photography",
      },
      {
        name: "Birla Mandir Jaipur",
        slug: "birla-mandir-jaipur",
        category: "spiritual",
        area: "Tilak Nagar",
        lat: 26.8942,
        lng: 75.8223,
        typicalCostInr: 0,
        durationMinutes: 45,
        openingTime: "06:00",
        closingTime: "21:00",
        bestSeason: "year-round",
        popularityScore: 72,
        description: "White marble Laxmi Narayan temple — serene views of Moti Doongri fort from the hilltop.",
        vibes: "spiritual, photography",
      },
    ],
  },
  {
    name: "Rishikesh",
    slug: "rishikesh",
    state: "Uttarakhand",
    lat: 30.0869,
    lng: 78.2676,
    description: "Yoga capital of the world on the Ganges — adventure, spirituality, and Himalayan scenery.",
    aliases: ["Hrishikesh"],
    places: [
      {
        name: "Triveni Ghat",
        slug: "triveni-ghat-rishikesh",
        category: "spiritual",
        area: "Rishikesh",
        lat: 30.1218,
        lng: 78.2973,
        typicalCostInr: 0,
        durationMinutes: 60,
        openingTime: "05:00",
        closingTime: "22:00",
        bestSeason: "year-round",
        popularityScore: 90,
        description: "Sacred ghat where three rivers meet — Ganga aarti at sunset is unmissable.",
        vibes: "spiritual, photography, local_experience",
      },
      {
        name: "Beatles Ashram",
        slug: "beatles-ashram-rishikesh",
        category: "culture",
        area: "Tapovan",
        lat: 30.1127,
        lng: 78.3204,
        typicalCostInr: 600,
        durationMinutes: 90,
        openingTime: "09:00",
        closingTime: "17:00",
        bestSeason: "year-round",
        popularityScore: 82,
        description: "Abandoned ashram where The Beatles meditated in 1968 — now an open-air art gallery in the jungle.",
        vibes: "culture, history, nature, photography",
      },
      {
        name: "Laxman Jhula",
        slug: "laxman-jhula-rishikesh",
        category: "sightseeing",
        area: "Laxman Jhula",
        lat: 30.1214,
        lng: 78.3203,
        typicalCostInr: 0,
        durationMinutes: 45,
        openingTime: "06:00",
        closingTime: "21:00",
        bestSeason: "year-round",
        popularityScore: 88,
        description: "Iconic suspension footbridge over the Ganges — temples on both banks, monkeys everywhere.",
        vibes: "sightseeing, photography, spiritual",
      },
      {
        name: "Parmarth Niketan Ashram",
        slug: "parmarth-niketan-rishikesh",
        category: "spiritual",
        area: "Ram Jhula",
        lat: 30.1116,
        lng: 78.3160,
        typicalCostInr: 0,
        durationMinutes: 60,
        openingTime: "05:30",
        closingTime: "22:00",
        bestSeason: "year-round",
        popularityScore: 85,
        description: "India's largest ashram — famous Ganga aarti ceremony every evening.",
        vibes: "spiritual, yoga, local_experience",
      },
      {
        name: "Shivpuri Rafting",
        slug: "shivpuri-rafting-rishikesh",
        category: "adventure",
        area: "Shivpuri",
        lat: 30.1433,
        lng: 78.3485,
        typicalCostInr: 600,
        durationMinutes: 150,
        openingTime: "08:00",
        closingTime: "15:00",
        bestSeason: "Mar-Jun,Sep-Nov",
        popularityScore: 92,
        description: "White-water rafting on the Ganges — grade 3 rapids, 16 km from Shivpuri to Rishikesh.",
        vibes: "adventure, nature",
      },
      {
        name: "Chotiwala Restaurant",
        slug: "chotiwala-restaurant-rishikesh",
        category: "dining",
        area: "Laxman Jhula",
        lat: 30.1225,
        lng: 78.3190,
        typicalCostInr: 300,
        durationMinutes: 60,
        openingTime: "08:00",
        closingTime: "22:00",
        bestSeason: "year-round",
        popularityScore: 80,
        description: "Legendary vegetarian restaurant since 1958 — famous for thali and lassi.",
        vibes: "dining, local_experience",
      },
      {
        name: "Ram Jhula",
        slug: "ram-jhula-rishikesh",
        category: "sightseeing",
        area: "Ram Jhula",
        lat: 30.1130,
        lng: 78.3115,
        typicalCostInr: 0,
        durationMinutes: 30,
        openingTime: "06:00",
        closingTime: "21:00",
        bestSeason: "year-round",
        popularityScore: 83,
        description: "Suspension footbridge by Parmarth Niketan — panoramic Ganges views and busy ashram ghats.",
        vibes: "sightseeing, spiritual, photography",
      },
      {
        name: "Bungee Jumping Rishikesh",
        slug: "bungee-jumping-rishikesh",
        category: "adventure",
        area: "Mohan Chatti",
        lat: 30.1352,
        lng: 78.3556,
        typicalCostInr: 3500,
        durationMinutes: 90,
        openingTime: "09:30",
        closingTime: "16:30",
        bestSeason: "Sep-Jun",
        popularityScore: 87,
        description: "India's highest fixed platform bungee jump at 83 metres over a river gorge.",
        vibes: "adventure",
      },
    ],
  },
  {
    name: "Goa",
    slug: "goa",
    state: "Goa",
    lat: 15.2993,
    lng: 74.1240,
    description: "India's beach paradise — sun, sand, Portuguese heritage, and vibrant nightlife.",
    aliases: ["North Goa", "South Goa"],
    places: [
      {
        name: "Calangute Beach",
        slug: "calangute-beach-goa",
        category: "nature",
        area: "North Goa",
        lat: 15.5440,
        lng: 73.7553,
        typicalCostInr: 0,
        durationMinutes: 120,
        openingTime: null,
        closingTime: null,
        bestSeason: "Nov-Feb",
        popularityScore: 90,
        description: "Largest beach in Goa — lively, with water sports, shacks, and market stalls.",
        vibes: "nature, relaxation, adventure",
      },
      {
        name: "Basilica of Bom Jesus",
        slug: "basilica-bom-jesus-goa",
        category: "culture",
        area: "Old Goa",
        lat: 15.5008,
        lng: 73.9116,
        typicalCostInr: 0,
        durationMinutes: 60,
        openingTime: "09:00",
        closingTime: "18:30",
        bestSeason: "year-round",
        popularityScore: 88,
        description: "UNESCO World Heritage site — Baroque church holding the mortal remains of St Francis Xavier.",
        vibes: "culture, history, spiritual",
      },
      {
        name: "Fort Aguada",
        slug: "fort-aguada-goa",
        category: "history",
        area: "Candolim",
        lat: 15.4936,
        lng: 73.7748,
        typicalCostInr: 0,
        durationMinutes: 75,
        openingTime: "09:30",
        closingTime: "18:00",
        bestSeason: "Oct-Mar",
        popularityScore: 85,
        description: "Well-preserved 17th-century Portuguese fort with panoramic views over the Arabian Sea.",
        vibes: "history, photography, sightseeing",
      },
      {
        name: "Anjuna Flea Market",
        slug: "anjuna-flea-market-goa",
        category: "shopping",
        area: "Anjuna",
        lat: 15.5739,
        lng: 73.7444,
        typicalCostInr: 0,
        durationMinutes: 120,
        openingTime: "08:00",
        closingTime: "18:00",
        bestSeason: "Nov-Feb",
        popularityScore: 82,
        description: "Famous Wednesday flea market — handicrafts, clothes, jewellery, and spices.",
        vibes: "shopping, local_experience",
      },
      {
        name: "Palolem Beach",
        slug: "palolem-beach-goa",
        category: "relaxation",
        area: "South Goa",
        lat: 15.0100,
        lng: 74.0233,
        typicalCostInr: 0,
        durationMinutes: 150,
        openingTime: null,
        closingTime: null,
        bestSeason: "Oct-Mar",
        popularityScore: 87,
        description: "Crescent-shaped beach in South Goa — calmer and less crowded than North Goa beaches.",
        vibes: "relaxation, nature, photography",
      },
      {
        name: "Thalassa Greek Restaurant",
        slug: "thalassa-goa",
        category: "dining",
        area: "Vagator",
        lat: 15.5832,
        lng: 73.7630,
        typicalCostInr: 1200,
        durationMinutes: 90,
        openingTime: "12:00",
        closingTime: "23:00",
        bestSeason: "Oct-Mar",
        popularityScore: 83,
        description: "Clifftop Greek-Mediterranean restaurant with stunning sunset views over the Arabian Sea.",
        vibes: "dining, nightlife, photography",
      },
      {
        name: "Dudhsagar Falls",
        slug: "dudhsagar-falls-goa",
        category: "nature",
        area: "Mollem",
        lat: 15.3144,
        lng: 74.3140,
        typicalCostInr: 400,
        durationMinutes: 180,
        openingTime: "06:00",
        closingTime: "18:00",
        bestSeason: "Jun-Feb",
        popularityScore: 86,
        description: "One of India's tallest waterfalls at 310m — jeep safari through the rainforest required.",
        vibes: "nature, adventure, photography",
      },
      {
        name: "Baga Beach Nightlife",
        slug: "baga-beach-nightlife-goa",
        category: "nightlife",
        area: "Baga",
        lat: 15.5519,
        lng: 73.7506,
        typicalCostInr: 1500,
        durationMinutes: 180,
        openingTime: "21:00",
        closingTime: "04:00",
        bestSeason: "Oct-Mar",
        popularityScore: 80,
        description: "Goa's most famous party beach — Tito's Lane, Café Mambo, and beach shacks.",
        vibes: "nightlife, shopping, dining",
      },
    ],
  },
];

// ── Seeder ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding dev fixture — NOT real production travel data");
  console.log("All records marked sourceType=fixture, dataStatus=seed\n");

  for (const dest of DESTINATIONS) {
    const { places, aliases, ...destData } = dest;

    const created = await prisma.travelDestination.upsert({
      where: { slug: destData.slug },
      create: { ...destData, dataStatus: "seed" },
      update: { lat: destData.lat, lng: destData.lng, description: destData.description },
    });

    console.log(`Destination: ${created.name} (${created.id})`);

    // Aliases
    for (const alias of aliases) {
      await prisma.destinationAlias.upsert({
        where: { alias },
        create: { alias, destinationId: created.id },
        update: { destinationId: created.id },
      });
    }

    // Places
    let placeCount = 0;
    for (const place of places) {
      await prisma.place.upsert({
        where: { slug: place.slug },
        create: {
          ...place,
          destinationId: created.id,
          dataStatus: "seed",
          sourceType: "fixture",
        },
        update: {
          lat: place.lat,
          lng: place.lng,
          typicalCostInr: place.typicalCostInr,
          popularityScore: place.popularityScore,
        },
      });
      placeCount++;
    }

    console.log(`  ${placeCount} places seeded\n`);
  }

  console.log("Fixture seed complete.");
  console.log("REMINDER: This is test/dev data. Do not use for production.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
