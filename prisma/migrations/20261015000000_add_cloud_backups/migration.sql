CREATE TABLE "CloudBackup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "chunkCount" INTEGER NOT NULL,
    "compressedBytes" INTEGER NOT NULL,
    "originalBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CloudBackup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CloudBackupChunk" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "plaintextChecksum" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBackupChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CloudBackup_businessId_status_createdAt_idx"
    ON "CloudBackup"("businessId", "status", "createdAt");

CREATE UNIQUE INDEX "CloudBackupChunk_backupId_chunkIndex_key"
    ON "CloudBackupChunk"("backupId", "chunkIndex");

ALTER TABLE "CloudBackup"
    ADD CONSTRAINT "CloudBackup_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CloudBackupChunk"
    ADD CONSTRAINT "CloudBackupChunk_backupId_fkey"
    FOREIGN KEY ("backupId") REFERENCES "CloudBackup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
