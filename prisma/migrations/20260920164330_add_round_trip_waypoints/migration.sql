-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "isRoundTrip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnDestination" TEXT,
ADD COLUMN     "travelerComposition" TEXT,
ADD COLUMN     "waypoints" TEXT;
