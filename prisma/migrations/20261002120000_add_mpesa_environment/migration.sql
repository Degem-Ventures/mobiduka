ALTER TABLE "MpesaIntegration"
ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'sandbox';