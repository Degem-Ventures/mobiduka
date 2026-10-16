ALTER TABLE "CloudBackup"
    ADD COLUMN "restoreProgressPercent" INTEGER,
    ADD COLUMN "restoreProgressMessage" TEXT,
    ADD COLUMN "restoreStartedAt" TIMESTAMP(3);
