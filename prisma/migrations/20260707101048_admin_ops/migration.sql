-- CreateTable
CREATE TABLE "FeatureSwitch" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "whitelist" TEXT[],
    "allowUnknown" BOOLEAN,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureSwitch_feature_key" ON "FeatureSwitch"("feature");

-- CreateIndex
CREATE INDEX "OpsEvent_kind_resolvedAt_idx" ON "OpsEvent"("kind", "resolvedAt");

-- CreateIndex
CREATE INDEX "OpsEvent_createdAt_idx" ON "OpsEvent"("createdAt");

