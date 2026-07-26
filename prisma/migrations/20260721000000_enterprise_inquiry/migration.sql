-- Enterprise sales inquiries submitted from the pricing page "Contact Sales"
-- form. Enterprise is contract-priced (no Stripe price), so a submission is a
-- lead record rather than a subscription. Anonymous — no account required.

CREATE TABLE "EnterpriseInquiry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnterpriseInquiry_createdAt_idx" ON "EnterpriseInquiry"("createdAt");
