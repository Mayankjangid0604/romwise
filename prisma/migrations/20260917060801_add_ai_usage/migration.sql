-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tripId" TEXT,
    "task" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorType" TEXT,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "AIUsage_tripId_idx" ON "AIUsage"("tripId");

-- CreateIndex
CREATE INDEX "AIUsage_task_idx" ON "AIUsage"("task");
