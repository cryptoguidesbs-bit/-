-- CreateEnum
CREATE TYPE "NewsRegion" AS ENUM ('US', 'EUROPE', 'ASIA', 'GLOBAL');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('MARKET', 'REGULATION', 'TECHNOLOGY', 'DEFI', 'MACRO', 'GENERAL');

-- CreateEnum
CREATE TYPE "NewsAiStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HELD');

-- CreateEnum
CREATE TYPE "NewsSentiment" AS ENUM ('BULLISH', 'NEUTRAL', 'BEARISH');

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "region" "NewsRegion" NOT NULL,
    "category" "NewsCategory" NOT NULL DEFAULT 'GENERAL',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiStatus" "NewsAiStatus" NOT NULL DEFAULT 'PENDING',
    "summaryKo" TEXT,
    "summaryEn" TEXT,
    "sentiment" "NewsSentiment",
    "confidence" INTEGER,
    "aiModel" TEXT,
    "aiAttempts" INTEGER NOT NULL DEFAULT 0,
    "aiHoldReason" TEXT,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_urlHash_key" ON "NewsItem"("urlHash");

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_idx" ON "NewsItem"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsItem_aiStatus_publishedAt_idx" ON "NewsItem"("aiStatus", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsItem_category_publishedAt_idx" ON "NewsItem"("category", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsItem_region_publishedAt_idx" ON "NewsItem"("region", "publishedAt");

