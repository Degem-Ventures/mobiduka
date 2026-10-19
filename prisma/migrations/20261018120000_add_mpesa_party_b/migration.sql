ALTER TABLE "MpesaIntegration"
  ADD COLUMN IF NOT EXISTS "partyB" TEXT;

UPDATE "MpesaIntegration"
SET "partyB" = "shortcode"
WHERE "partyB" IS NULL;

ALTER TABLE "MpesaIntegration"
  ALTER COLUMN "partyB" SET NOT NULL;
