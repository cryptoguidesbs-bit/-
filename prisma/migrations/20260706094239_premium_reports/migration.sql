-- CreateEnum
CREATE TYPE "ReportCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('ETF', 'MACRO', 'ONCHAIN');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "cadence" "ReportCadence",
ADD COLUMN     "category" "ReportCategory",
ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "reviewNote" TEXT;

