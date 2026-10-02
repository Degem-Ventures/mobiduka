-- Tenant-scoped, encrypted Daraja credential records. Plaintext credentials
-- never belong in BusinessSettings.paymentConfig.
CREATE TABLE "MpesaIntegration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "accountReference" TEXT,
    "credentialCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MpesaIntegration_businessId_key" ON "MpesaIntegration"("businessId");

ALTER TABLE "MpesaIntegration"
ADD CONSTRAINT "MpesaIntegration_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MpesaTransaction" ADD COLUMN "mpesaIntegrationId" TEXT;

CREATE INDEX "MpesaTransaction_businessId_status_idx" ON "MpesaTransaction"("businessId", "status");
CREATE INDEX "MpesaTransaction_mpesaIntegrationId_idx" ON "MpesaTransaction"("mpesaIntegrationId");

ALTER TABLE "MpesaTransaction"
ADD CONSTRAINT "MpesaTransaction_mpesaIntegrationId_fkey"
FOREIGN KEY ("mpesaIntegrationId") REFERENCES "MpesaIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
