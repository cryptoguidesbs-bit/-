-- CreateEnum
CREATE TYPE "BriefTier" AS ENUM ('STANDARD', 'DETAILED');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('PUBLISHED', 'HELD');

-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'BRIEF';

-- CreateTable
CREATE TABLE "MarketBrief" (
    "id" TEXT NOT NULL,
    "briefDate" TEXT NOT NULL,
    "tier" "BriefTier" NOT NULL,
    "status" "BriefStatus" NOT NULL,
    "sections" JSONB NOT NULL,
    "inputsSnapshot" JSONB,
    "aiModel" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "holdReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketBrief_status_briefDate_idx" ON "MarketBrief"("status", "briefDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketBrief_briefDate_tier_key" ON "MarketBrief"("briefDate", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_day_key" ON "AiUsage"("day");

