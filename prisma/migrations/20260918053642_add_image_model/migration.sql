-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT,
    "sourceId" TEXT,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "credit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "destinationId" TEXT,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_destinationId_idx" ON "Image"("destinationId");

-- CreateIndex
CREATE INDEX "Image_placeId_idx" ON "Image"("placeId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "TravelDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
