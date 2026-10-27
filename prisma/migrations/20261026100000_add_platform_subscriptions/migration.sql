CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'BASIC',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "licenseCost" INTEGER NOT NULL DEFAULT 2500,
    "autoRenewActive" BOOLEAN NOT NULL DEFAULT true,
    "isTrialClaimed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformSubscription_businessId_key" ON "PlatformSubscription"("businessId");
CREATE INDEX "PlatformSubscription_status_trialEndsAt_idx" ON "PlatformSubscription"("status", "trialEndsAt");
CREATE INDEX "PlatformSubscription_status_currentPeriodEndsAt_idx" ON "PlatformSubscription"("status", "currentPeriodEndsAt");

ALTER TABLE "PlatformSubscription"
ADD CONSTRAINT "PlatformSubscription_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlatformSubscription" (
    "id",
    "businessId",
    "planType",
    "status",
    "trialEndsAt",
    "currentPeriodEndsAt",
    "graceEndsAt",
    "licenseCost",
    "autoRenewActive",
    "isTrialClaimed",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    business."id",
    CASE
        WHEN legacy."licenseType" ILIKE '%enterprise%' THEN 'ENTERPRISE'
        WHEN legacy."licenseType" ILIKE '%growth%' THEN 'GROWTH'
        ELSE 'BASIC'
    END,
    CASE
        WHEN UPPER(business."status") <> 'ACTIVE' OR UPPER(legacy."status") = 'REVOKED' THEN 'REVOKED'
        WHEN legacy."id" IS NULL THEN 'TRIAL'
        WHEN UPPER(legacy."status") = 'EXPIRED' OR legacy."expiryDate" <= CURRENT_TIMESTAMP THEN 'EXPIRED'
        ELSE 'ACTIVE'
    END,
    CASE WHEN legacy."id" IS NULL THEN CURRENT_TIMESTAMP + INTERVAL '14 days' ELSE NULL END,
    CASE WHEN legacy."id" IS NOT NULL THEN legacy."expiryDate" ELSE NULL END,
    NULL,
    CASE
        WHEN legacy."licenseType" ILIKE '%enterprise%' THEN 12500
        WHEN legacy."licenseType" ILIKE '%growth%' THEN 5500
        ELSE 2500
    END,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Business" AS business
LEFT JOIN LATERAL (
    SELECT license."id", license."licenseType", license."status", license."expiryDate"
    FROM "License" AS license
    WHERE license."businessId" = business."id"
    ORDER BY license."expiryDate" DESC, license."createdAt" DESC
    LIMIT 1
) AS legacy ON true;
