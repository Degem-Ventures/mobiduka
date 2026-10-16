ALTER TABLE "CloudBackup"
    ADD COLUMN "recordCount" INTEGER,
    ADD COLUMN "collectionCount" INTEGER,
    ADD COLUMN "queuedRecordCount" INTEGER;
