-- CreateEnum
CREATE TYPE "MapPlaceSource" AS ENUM ('BTCMAP', 'MANUAL');

-- CreateEnum
CREATE TYPE "RegulationStatus" AS ENUM ('FRIENDLY', 'REGULATED', 'RESTRICTED', 'HOSTILE', 'UNCLEAR');

-- CreateTable
CREATE TABLE "MapPlace" (
    "id" TEXT NOT NULL,
    "source" "MapPlaceSource" NOT NULL DEFAULT 'BTCMAP',
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "coins" TEXT[],
    "address" TEXT,
    "countryCode" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryRegulation" (
    "countryCode" TEXT NOT NULL,
    "status" "RegulationStatus" NOT NULL,
    "summaryKo" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "sourceNote" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryRegulation_pkey" PRIMARY KEY ("countryCode")
);

-- CreateIndex
CREATE INDEX "MapPlace_lat_lng_idx" ON "MapPlace"("lat", "lng");

-- CreateIndex
CREATE INDEX "MapPlace_category_idx" ON "MapPlace"("category");

-- CreateIndex
CREATE INDEX "MapPlace_countryCode_idx" ON "MapPlace"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "MapPlace_source_externalId_key" ON "MapPlace"("source", "externalId");

