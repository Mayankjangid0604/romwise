-- AlterTable
ALTER TABLE "TravelDestination" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "parentDestinationId" TEXT,
ADD COLUMN     "sourceRecordId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- CreateIndex
CREATE INDEX "TravelDestination_parentDestinationId_idx" ON "TravelDestination"("parentDestinationId");

-- AddForeignKey
ALTER TABLE "TravelDestination" ADD CONSTRAINT "TravelDestination_parentDestinationId_fkey" FOREIGN KEY ("parentDestinationId") REFERENCES "TravelDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
