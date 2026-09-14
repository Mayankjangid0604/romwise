-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bestFor" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "costMaxInr" INTEGER,
ADD COLUMN     "costMinInr" INTEGER,
ADD COLUMN     "costStatus" TEXT,
ADD COLUMN     "fatigueCost" INTEGER,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "openingDays" TEXT,
ADD COLUMN     "openingHoursStatus" TEXT,
ADD COLUMN     "seasonStatus" TEXT,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceRecordId" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "TravelDestination" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "destinationType" TEXT,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "notes" TEXT,
    "accessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_name_key" ON "DataSource"("name");

-- CreateIndex
CREATE INDEX "Place_dataStatus_idx" ON "Place"("dataStatus");
