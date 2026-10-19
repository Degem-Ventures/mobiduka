DROP INDEX "MpesaIntegration_businessId_key";

CREATE UNIQUE INDEX "MpesaIntegration_businessId_environment_key"
ON "MpesaIntegration"("businessId", "environment");