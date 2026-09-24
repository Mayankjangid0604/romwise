import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { CollectionTheme, RecommendedDestination, CollectionRecommendationRequest } from "./types";
import { COLLECTIONS } from "./collections";

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

  const limit = req.limit || 12;

  // We want to rank destinations based on the collection's scoreSql.
  // We also want to know total places, stays, and if there's an image.
  // We'll join TravelDestination (d) with Place (p) and Image (i).
  // Note: Prisma.sql doesn't let us interpolate arbitrary strings safely for SQL columns unless we use Prisma.raw for the snippet.
  
  const query = Prisma.sql`
    WITH dest_scores AS (
      SELECT 
        d.id as "destinationId",
        d.name as "name",
        d.state as "state",
        (SELECT url FROM "Image" i WHERE i."destinationId" = d.id LIMIT 1) as "imageUrl",
        COUNT(p.id) as "totalPlaces",
        SUM(CASE WHEN p.category = 'stay' THEN 1 ELSE 0 END) as "stayCount",
        ${Prisma.raw(collection.scoreSql)} as "rawScore"
      FROM "TravelDestination" d
      LEFT JOIN "Place" p ON p."destinationId" = d.id
      GROUP BY d.id, d.name, d.state
    )
    SELECT *
    FROM dest_scores
    WHERE "rawScore" > 0
      AND "totalPlaces" >= 4 -- Minimum requirement to be recommendable
      ${req.state ? Prisma.sql`AND "state" = ${req.state}` : Prisma.empty}
    ORDER BY "rawScore" DESC, "totalPlaces" DESC
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
  };

  const results = await prisma.$queryRaw<RawResult[]>(query);

  const maxRawScore = Math.max(...results.map(r => Number(r.rawScore)), 1);

  return results.map((row) => {
    const totalPlaces = Number(row.totalPlaces);
    const stayCount = Number(row.stayCount);
    
    // Normalize matchScore to 0-100 based on relative performance in this query
    // But also cap it so that a low absolute score doesn't become 100%.
    const relativeScore = (Number(row.rawScore) / maxRawScore) * 100;
    const matchScore = Math.round(Math.min(relativeScore, 98));

    return {
      id: row.destinationId,
      name: row.name,
      state: row.state,
      imageUrl: row.imageUrl || undefined,
      matchScore,
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
