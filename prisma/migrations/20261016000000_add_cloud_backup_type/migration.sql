ALTER TABLE "CloudBackup"
    ADD COLUMN "backupType" TEXT NOT NULL DEFAULT 'DEVICE';

DROP INDEX "CloudBackup_businessId_status_createdAt_idx";

CREATE INDEX "CloudBackup_businessId_backupType_status_createdAt_idx"
    ON "CloudBackup"("businessId", "backupType", "status", "createdAt");
