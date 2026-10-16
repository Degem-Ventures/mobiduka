ALTER TABLE "CloudBackup"
    ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "progressMessage" TEXT;
