-- AlterTable (idempotent — columns may already exist from earlier migration 20260920164330)
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "isRoundTrip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "returnDestination" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "travelerComposition" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "waypoints" TEXT;
