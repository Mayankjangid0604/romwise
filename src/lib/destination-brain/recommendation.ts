import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { CollectionTheme, RecommendedDestination, CollectionRecommendationRequest } from "./types";
import { COLLECTIONS } from "./collections";
import { getTourismProminenceSql } from "./tourism-prior";

function determineReadiness(placeCount: number): "BASIC" | "GOOD_COVERAGE" | "STRONG_COVERAGE" | "NONE" {
  if (placeCount >= 20) return "STRONG_COVERAGE";
  if (placeCount >= 10) return "GOOD_COVERAGE";
  if (placeCount >= 4) return "BASIC";
  return "NONE";
}

function calculateConfidence(placeCount: number, stayCount: number): number {
  let conf = 0;
  if (placeCount > 0) conf += 50;
  if (placeCount > 10) conf += 20;
  if (placeCount > 20) conf += 10;
  
  if (stayCount > 0) conf += 10;
  if (stayCount > 10) conf += 10;
  
  return conf;
}

export async function getDestinationsForCollection(
  req: CollectionRecommendationRequest
): Promise<RecommendedDestination[]> {
  const collection = COLLECTIONS[req.theme];
  if (!collection) {
    throw new Error(`Unknown collection theme: ${req.theme}`);
  }

  const limit = req.limit || 30; // Fetch more to allow tiers

  // We want to rank destinations based on the collection's scoreSql, PLUS prominence.
  // Prominence is based on total places, stays, and if it has a description/image.
  const query = Prisma.sql`
    WITH dest_scores AS (
      SELECT 
        d.id as "destinationId",
        d.name as "name",
        d.state as "state",
        d.description as "description",
        (SELECT url FROM "Image" i WHERE i."destinationId" = d.id LIMIT 1) as "imageUrl",
        COUNT(p.id) as "totalPlaces",
        SUM(CASE WHEN p.category = 'stay' THEN 1 ELSE 0 END) as "stayCount",
        ${Prisma.raw(collection.scoreSql)} as "rawScore",
        (
          -- Prominence Score Calculation
          -- Base tourism prior
          ${Prisma.raw(getTourismProminenceSql("d"))} +
          -- Maximize at 100 to prevent mega-cities from dominating purely by volume
          LEAST(COUNT(p.id), 25) * 2 + 
          LEAST(SUM(CASE WHEN p.category = 'stay' THEN 1 ELSE 0 END), 10) * 3 +
          (CASE WHEN d.description IS NOT NULL AND length(d.description) > 10 THEN 10 ELSE 0 END) +
          (CASE WHEN (SELECT 1 FROM "Image" i WHERE i."destinationId" = d.id LIMIT 1) IS NOT NULL THEN 20 ELSE 0 END) +
          (CASE WHEN d."sourceType" = 'WIKIDATA' THEN 10 ELSE 0 END)
        ) as "prominenceScore"
      FROM "TravelDestination" d
      LEFT JOIN "Place" p ON p."destinationId" = d.id
      GROUP BY d.id, d.name, d.state, d.description, d."sourceType"
    )
    SELECT *
    FROM dest_scores
    WHERE "rawScore" > 0
      AND "totalPlaces" >= 5
      ${req.state ? Prisma.sql`AND "state" = ${req.state}` : Prisma.empty}
      ${req.q ? Prisma.sql`AND (name ILIKE ${'%' + req.q + '%'} OR state ILIKE ${'%' + req.q + '%'})` : Prisma.empty}
    -- Rank by rawScore, multiplied by density (rawScore/totalPlaces) to penalize generic mega-cities, then scale by prominence.
    -- Logarithmic scaling on totalPlaces prevents 300-place cities from getting a 10x multiplier over 30-place towns.
    ORDER BY 
      ${req.q ? Prisma.sql`
        CASE 
          WHEN name ILIKE ${req.q} THEN 1000000 
          WHEN name ILIKE ${req.q + '%'} THEN 100000 
          WHEN state ILIKE ${req.q} THEN 10000
          ELSE 0 
        END + 
      ` : Prisma.empty}
      ("rawScore" * ("rawScore" / CAST("totalPlaces" AS FLOAT)) * "prominenceScore") DESC, "totalPlaces" DESC
    LIMIT ${limit}
  `;

  type RawResult = {
    destinationId: string;
    name: string;
    state: string;
    imageUrl: string | null;
    totalPlaces: bigint;
    stayCount: bigint;
    rawScore: number;
    prominenceScore: number;
  };

  const results = await prisma.$queryRaw<RawResult[]>(query);

  const maxRawScore = Math.max(...results.map(r => Number(r.rawScore)), 1);

  return results.map((row) => {
    const totalPlaces = Number(row.totalPlaces);
    const stayCount = Number(row.stayCount);
    const prominence = Number(row.prominenceScore);
    
    // Normalize matchScore to 0-100 based on relative performance
    const relativeScore = (Number(row.rawScore) / maxRawScore) * 100;
    const matchScore = Math.round(Math.min(relativeScore, 98));

    // Determine Tier based on prominence score and data coverage
    // Max prominence is now around 120 (50 + 30 + 10 + 20 + 10).
    let tier: 'major' | 'strong' | 'hidden' = 'hidden';
    if (prominence >= 80 && totalPlaces >= 20) {
      tier = 'major';
    } else if (prominence >= 50 && totalPlaces >= 10) {
      tier = 'strong';
    } else if (prominence < 20 || totalPlaces < 5 || stayCount === 0) {
      // It lacks basic data to be recommended, but we keep it as a weak hidden gem if it survived SQL
      tier = 'hidden';
    }

    return {
      id: row.destinationId,
      name: row.name,
      state: row.state,
      imageUrl: row.imageUrl || undefined,
      matchScore,
      prominenceScore: prominence,
      tier,
      confidence: calculateConfidence(totalPlaces, stayCount),
      reasons: [
        `Strong ${collection.title.toLowerCase()} match`,
        `${totalPlaces} known places and activities`,
        stayCount > 0 ? `${stayCount} accommodation options` : 'Stay options unknown'
      ],
      placeCount: totalPlaces,
      stayCount,
      generationReadiness: determineReadiness(totalPlaces)
    };
  });
}
