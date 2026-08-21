-- Rename the subscription tiers:
--   STANDARD → STARTER, PROFESSIONAL → TRADER,
--   INSTITUTIONAL → PRO, LEGENDARY → WHALE
--
-- ALTER TYPE ... RENAME VALUE renames the label in place, so every existing
-- Subscription row keeps its tier (no data migration, no downtime window).
-- FREE is unchanged. NOTE: "BriefTier" also has a STANDARD value — it is a
-- different enum and is deliberately left untouched.

ALTER TYPE "SubscriptionPlan" RENAME VALUE 'STANDARD' TO 'STARTER';
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'PROFESSIONAL' TO 'TRADER';
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'INSTITUTIONAL' TO 'PRO';
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'LEGENDARY' TO 'WHALE';
