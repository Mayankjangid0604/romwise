-- AlterTable (idempotent — columns may already exist from earlier migration 20260920184239)
ALTER TABLE "TripAccommodation" ADD COLUMN IF NOT EXISTS "costPerNightInr" INTEGER;
ALTER TABLE "TripAccommodation" ADD COLUMN IF NOT EXISTS "nights" INTEGER;
ALTER TABLE "TripAccommodation" ADD COLUMN IF NOT EXISTS "totalCostInr" INTEGER;
