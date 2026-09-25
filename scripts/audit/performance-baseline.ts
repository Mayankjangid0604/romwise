import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();

async function run() {
  console.log('--- DATABASE LATENCY BASELINE ---');
  // Cold start latency
  let start = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  let end = performance.now();
  console.log(`Cold SELECT 1: ${(end - start).toFixed(2)}ms`);

  // Warm latency
  const latencies = [];
  for (let i = 0; i < 20; i++) {
    start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    end = performance.now();
    latencies.push(end - start);
  }
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  console.log(`Warm SELECT 1 (20 iterations) - p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`);

  console.log('\n--- DATABASE SIZE BASELINE ---');
  try {
    const destCount = await prisma.travelDestination.count();
    const placeCount = await prisma.place.count();
    const tripCount = await prisma.trip.count();
    const idCount = await prisma.itineraryDay.count();
    const iiCount = await prisma.itineraryItem.count();
    const gmCount = await prisma.groupMember.count();
    const expCount = await prisma.expense.count();
    const favCount = await prisma.favoriteDestination.count();
    const tpsCount = await prisma.tripPlaceSelection.count();

    console.log(`TravelDestination: ${destCount}`);
    console.log(`Place: ${placeCount}`);
    console.log(`Trip: ${tripCount}`);
    console.log(`ItineraryDay: ${idCount}`);
    console.log(`ItineraryItem: ${iiCount}`);
    console.log(`GroupMember: ${gmCount}`);
    console.log(`Expense: ${expCount}`);
    console.log(`FavoriteDestination: ${favCount}`);
    console.log(`TripPlaceSelection: ${tpsCount}`);
  } catch (e) {
    console.error("Failed to count:", e);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
