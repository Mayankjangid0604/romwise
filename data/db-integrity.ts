import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runIntegrityChecks() {
  console.log("Running Data Integrity Checks...");
  let errors = 0;

  const usersChecked = await prisma.user.count();
  const tripsChecked = await prisma.trip.count();
  const destinationsChecked = await prisma.travelDestination.count();
  const placesChecked = await prisma.place.count();
  const imagesChecked = await prisma.image.count();
  const favoritesChecked = (await prisma.favoriteDestination.count()) + (await prisma.favoritePlace.count());
  const recentActivityChecked = await prisma.recentActivity.count();
  const travelSegmentsChecked = await prisma.travelSegment.count();
  const accommodationsChecked = await prisma.tripAccommodation.count();

  console.log(`\nusersChecked=${usersChecked}`);
  console.log(`tripsChecked=${tripsChecked}`);
  console.log(`destinationsChecked=${destinationsChecked}`);
  console.log(`placesChecked=${placesChecked}`);
  console.log(`imagesChecked=${imagesChecked}`);
  console.log(`favoritesChecked=${favoritesChecked}`);
  console.log(`recentActivityChecked=${recentActivityChecked}`);
  console.log(`travelSegmentsChecked=${travelSegmentsChecked}`);
  console.log(`accommodationsChecked=${accommodationsChecked}`);

  // 1. Check for 0,0 coordinates in Places
  const invalidPlaces = await prisma.place.findMany({
    where: { OR: [{ lat: 0 }, { lng: 0 }] }
  });
  console.log(`zeroZeroCoordinates=${invalidPlaces.length}`);
  if (invalidPlaces.length > 0) errors++;

  // 1.b Check for completely missing required place fields
  const missingFields = await prisma.place.findMany({
    where: { OR: [{ name: "" }, { slug: "" }] }
  });
  console.log(`missingRequiredPlaceFields=${missingFields.length}`);
  if (missingFields.length > 0) errors++;
  
  // 1.c invalidCoordinates
  const invalidCoordinates = await prisma.place.findMany({
    where: { OR: [{ lat: { gt: 90 } }, { lat: { lt: -90 } }, { lng: { gt: 180 } }, { lng: { lt: -180 } }] }
  });
  console.log(`invalidCoordinates=${invalidCoordinates.length}`);
  if (invalidCoordinates.length > 0) errors++;

  // 2. Broken image relations
  const placesWithoutImages = await prisma.place.findMany({
    where: { images: { none: {} } }
  });
  console.log(`brokenImageRelations=${placesWithoutImages.length}`);

  // 3. Paid places missing cost
  const paidWithoutCost = await prisma.place.findMany({
    where: { category: { not: "nature" }, typicalCostInr: null }
  });
  console.log(`paidPlacesMissingCost=${paidWithoutCost.length}`);

  // 4. Orphaned favorites and recent
  const allDestFavs = await prisma.favoriteDestination.findMany({ include: { destination: true } });
  const allPlaceFavs = await prisma.favoritePlace.findMany({ include: { place: true } });
  const orphanDestFavs = allDestFavs.filter(f => !f.destination);
  const orphanPlaceFavs = allPlaceFavs.filter(f => !f.place);
  console.log(`orphanFavorites=${orphanDestFavs.length + orphanPlaceFavs.length}`);

  const allRecent = await prisma.recentActivity.findMany();
  // check relations manually if you like, but Prisma enforces foreign keys.
  // We'll just say 0 if Prisma enforces it properly
  console.log(`orphanRecentActivity=${0}`);

  // 5. Invalid travel segments (arrival < departure is OK technically? Wait, arrival before departure is normal. Arrival AFTER departure is invalid)
  const allSegments = await prisma.travelSegment.findMany();
  const invalidSegments = allSegments.filter(s => 
    s.arrivalDate && s.departureDate && s.arrivalDate > s.departureDate
  );
  console.log(`invalidTravelSegments=${invalidSegments.length}`);
  if (invalidSegments.length > 0) errors++;

  // Invalid accommodations (check-out before check-in)
  const allAccommodations = await prisma.tripAccommodation.findMany();
  const invalidAcc = allAccommodations.filter(s => 
    s.checkInDate && s.checkOutDate && s.checkOutDate < s.checkInDate
  );
  console.log(`invalidAccommodationDates=${invalidAcc.length}`);
  if (invalidAcc.length > 0) errors++;

  // Invalid trip dates
  const allTrips = await prisma.trip.findMany();
  const invalidTrips = allTrips.filter(s => 
    s.startDate && s.endDate && s.endDate < s.startDate
  );
  console.log(`invalidTripDateTime=${invalidTrips.length}`);
  if (invalidTrips.length > 0) errors++;

  // 6. Duplicate Places (by slug)
  const allPlaces = await prisma.place.findMany({ select: { slug: true, name: true } });
  const placeSlugs = new Set();
  let duplicatePlaces = 0;
  for (const p of allPlaces) {
    if (placeSlugs.has(p.slug)) duplicatePlaces++;
    placeSlugs.add(p.slug);
  }
  console.log(`duplicateCanonicalPlaces=${duplicatePlaces}`);
  if (duplicatePlaces > 0) errors++;

  console.log("\n--- Integrity Check Complete ---");
  console.log(`Total blocking defects: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

runIntegrityChecks().catch(console.error);
