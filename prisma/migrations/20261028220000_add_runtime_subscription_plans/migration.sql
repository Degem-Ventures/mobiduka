CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceKsh" INTEGER NOT NULL,
    "publicMonthlyPriceKsh" INTEGER,
    "annualPriceKsh" INTEGER,
    "priceSuffix" TEXT,
    "subtitle" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "tenants" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL,
    "adminFeatures" JSONB NOT NULL,
    "marketingFeatures" JSONB NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "cta" TEXT NOT NULL,
    "upgradeRulesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onlineCheckoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE INDEX "SubscriptionPlan_isActive_sortOrder_idx" ON "SubscriptionPlan"("isActive", "sortOrder");

INSERT INTO "SubscriptionPlan" (
    "id", "name", "monthlyPriceKsh", "publicMonthlyPriceKsh", "annualPriceKsh",
    "priceSuffix", "subtitle", "audience", "tenants", "color", "adminFeatures",
    "marketingFeatures", "featured", "cta", "upgradeRulesEnabled", "onlineCheckoutEnabled",
    "isActive", "sortOrder"
) VALUES
(
    'basic', 'Basic', 2500, NULL, NULL, NULL, 'Standard Duka', 'Small dukas and kiosks',
    734, 'blue', '["1 store · 3 users", "Core POS & inventory", "Standard support"]'::jsonb,
    '["Sales management", "Product and stock tracking", "Essential business reports", "Staff access controls"]'::jsonb,
    false, 'Choose Basic', true, false, true, 0
),
(
    'growth', 'Growth', 5500, NULL, NULL, NULL, 'Multi-store operator', 'Busy shops and expanding retailers',
    421, 'green', '["3 stores · 15 users", "Reports & staff controls", "Priority support"]'::jsonb,
    '["Everything in Basic", "Expanded reports and insights", "More comprehensive workflows", "Support for growing teams"]'::jsonb,
    true, 'Choose Growth', true, false, true, 1
),
(
    'enterprise', 'Enterprise', 12500, NULL, NULL, '+', 'Mega-supermarket', 'Larger and multi-branch retailers',
    129, 'gold', '["Unlimited terminals", "Advanced IAM & API", "Dedicated success manager"]'::jsonb,
    '["Advanced business oversight", "Expanded team management", "Multi-branch options where supported", "Enterprise onboarding"]'::jsonb,
    false, 'Contact Sales', false, false, true, 2
);

CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amountKsh" INTEGER NOT NULL,
    "billingDays" INTEGER NOT NULL DEFAULT 30,
    "phoneNumber" TEXT NOT NULL,
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultCode" INTEGER,
    "resultDescription" TEXT,
    "reportedAmountKsh" INTEGER,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformPayment_checkoutRequestId_key" ON "PlatformPayment"("checkoutRequestId");
CREATE UNIQUE INDEX "PlatformPayment_receiptNumber_key" ON "PlatformPayment"("receiptNumber");
CREATE INDEX "PlatformPayment_businessId_createdAt_idx" ON "PlatformPayment"("businessId", "createdAt");
CREATE INDEX "PlatformPayment_status_createdAt_idx" ON "PlatformPayment"("status", "createdAt");

ALTER TABLE "PlatformPayment"
ADD CONSTRAINT "PlatformPayment_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
