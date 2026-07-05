-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'STANDARD', 'PROFESSIONAL', 'INSTITUTIONAL', 'LEGENDARY');
ALTER TABLE "public"."Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ("plan"::text::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "public"."SubscriptionPlan_old";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';
COMMIT;

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'INCOMPLETE';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "externalCustomerId" TEXT,
ADD COLUMN     "interval" "SubscriptionInterval";
