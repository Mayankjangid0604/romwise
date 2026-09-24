-- DropForeignKey
ALTER TABLE "StaySelection" DROP CONSTRAINT IF EXISTS "StaySelection_tripId_fkey";

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "cuisine" TEXT,
ADD COLUMN     "osmRawHours" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "placeType" TEXT,
ADD COLUMN     "stars" INTEGER,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "wheelchair" TEXT;

-- DropTable
DROP TABLE IF EXISTS "StaySelection";

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceFile" TEXT,
    "sourceDate" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_sourceType_sourceRecordId_key" ON "Place"("sourceType", "sourceRecordId");
