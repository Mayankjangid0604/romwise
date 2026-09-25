-- CreateTable
CREATE TABLE "TripPlaceSelection" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPlaceSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripPlaceSelection_tripId_idx" ON "TripPlaceSelection"("tripId");

-- CreateIndex
CREATE INDEX "TripPlaceSelection_placeId_idx" ON "TripPlaceSelection"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "TripPlaceSelection_tripId_placeId_key" ON "TripPlaceSelection"("tripId", "placeId");

-- AddForeignKey
ALTER TABLE "TripPlaceSelection" ADD CONSTRAINT "TripPlaceSelection_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPlaceSelection" ADD CONSTRAINT "TripPlaceSelection_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "unscheduledPlaces" JSONB;
