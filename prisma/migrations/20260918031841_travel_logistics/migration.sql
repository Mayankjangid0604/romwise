-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "timeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "tripType" TEXT NOT NULL DEFAULT 'MULTI_DAY';

-- CreateTable
CREATE TABLE "TravelSegment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "originName" TEXT,
    "originLatitude" DOUBLE PRECISION,
    "originLongitude" DOUBLE PRECISION,
    "destinationName" TEXT,
    "destinationLatitude" DOUBLE PRECISION,
    "destinationLongitude" DOUBLE PRECISION,
    "departureDate" TIMESTAMP(3),
    "departureTime" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "arrivalTime" TEXT,
    "carrier" TEXT,
    "serviceNumber" TEXT,
    "bookingReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAccommodation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "checkInDate" TIMESTAMP(3),
    "checkOutDate" TIMESTAMP(3),
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "bookingReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripAccommodation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelSegment_tripId_idx" ON "TravelSegment"("tripId");

-- CreateIndex
CREATE INDEX "TripAccommodation_tripId_idx" ON "TripAccommodation"("tripId");

-- AddForeignKey
ALTER TABLE "TravelSegment" ADD CONSTRAINT "TravelSegment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAccommodation" ADD CONSTRAINT "TripAccommodation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
