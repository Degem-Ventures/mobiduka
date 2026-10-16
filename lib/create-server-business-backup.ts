import crypto from "node:crypto"
import { gzipSync } from "node:zlib"
import {
  CloudBackupEncryptionError,
  encryptCloudBackupChunk,
  validateCloudBackupEncryptionKey,
} from "@/lib/cloud-backup-crypto"
import { prisma } from "@/lib/prisma"
import {
  createServerBusinessBackupSnapshot,
  validateServerBusinessBackupSnapshot,
} from "@/lib/server-business-backup"

const chunkSize = 256 * 1024
const maxCompressedBytes = 64 * 1024 * 1024
const maxOriginalBytes = 256 * 1024 * 1024
const retainedBackups = 10

export type BackupTrigger = "AUTO" | "MANUAL"

export async function createServerBusinessBackup(
  businessId: string,
  userId: string | null,
  triggerType: BackupTrigger,
) {
  const backupId = crypto.randomUUID()
  await prisma.cloudBackup.deleteMany({
    where: {
      businessId,
      backupType: "SERVER",
      status: "FAILED",
      createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  })
  await prisma.cloudBackup.create({
    data: {
      id: backupId,
      businessId,
      backupType: "SERVER",
      triggerType,
      checksum: "",
      chunkCount: 0,
      compressedBytes: 0,
      originalBytes: 0,
      progressPercent: 0,
      progressMessage: "Preparing business snapshot",
      status: "PENDING",
    },
  })

  try {
    validateCloudBackupEncryptionKey()
    await prisma.cloudBackup.update({
      where: { id: backupId },
      data: {
        progressPercent: 5,
        progressMessage: "Reading business records",
      },
    })
    let progressWrites = Promise.resolve()
    const snapshot = await prisma.$transaction(
      (transaction) =>
        createServerBusinessBackupSnapshot(
          transaction,
          businessId,
          (completed, total, tableName) => {
            const progressPercent = 5 + Math.floor((completed / total) * 50)
            progressWrites = progressWrites.then(async () => {
              await prisma.cloudBackup.update({
                where: { id: backupId },
                data: {
                  progressPercent,
                  progressMessage: `Reading ${tableName} (${completed}/${total} tables)`,
                },
              })
            })
            return progressWrites.then(() => undefined)
          },
        ),
      { isolationLevel: "RepeatableRead", timeout: 60_000 },
    )
    await progressWrites
    await prisma.cloudBackup.update({
      where: { id: backupId },
      data: {
        progressPercent: 60,
        progressMessage: "Business data collected",
      },
    })
    if (!validateServerBusinessBackupSnapshot(snapshot, businessId)) {
      throw new Error("Server business data failed tenant integrity checks.")
    }

    const snapshotBytes = Buffer.from(JSON.stringify(snapshot), "utf8")
    if (snapshotBytes.length > maxOriginalBytes) {
      throw new Error(
        "Server business snapshot exceeds the 256 MiB backup limit.",
      )
    }
    const checksum = crypto
      .createHash("sha256")
      .update(snapshotBytes)
      .digest("hex")
    const recordCount = Object.values(snapshot.tables).reduce(
      (total, tableRows) => total + tableRows.length,
      0,
    )
    const compressed = gzipSync(snapshotBytes)
    if (compressed.length > maxCompressedBytes) {
      throw new Error(
        "Compressed server business snapshot exceeds the 64 MiB backup limit.",
      )
    }
    const chunkCount = Math.ceil(compressed.length / chunkSize)
    await prisma.cloudBackup.update({
      where: { id: backupId },
      data: {
        progressPercent: 65,
        progressMessage: "Snapshot compressed and ready for encryption",
      },
    })
    const chunks = []
    let lastEncryptionProgress = 65
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const plaintext = compressed.subarray(
        chunkIndex * chunkSize,
        Math.min((chunkIndex + 1) * chunkSize, compressed.length),
      )
      chunks.push({
        backupId,
        chunkIndex,
        plaintextChecksum: crypto
          .createHash("sha256")
          .update(plaintext)
          .digest("hex"),
        ...encryptCloudBackupChunk(
          businessId,
          backupId,
          chunkIndex,
          checksum,
          plaintext,
        ),
      })
      const progressPercent =
        65 + Math.floor(((chunkIndex + 1) / chunkCount) * 15)
      if (progressPercent >= lastEncryptionProgress + 2) {
        await prisma.cloudBackup.update({
          where: { id: backupId },
          data: {
            progressPercent,
            progressMessage: `Encrypting backup chunks (${chunkIndex + 1}/${chunkCount})`,
          },
        })
        lastEncryptionProgress = progressPercent
      }
    }

    const completedAt = new Date()
    const chunkBatchSize = 16
    const chunkBatchCount = Math.ceil(chunks.length / chunkBatchSize)
    for (let index = 0; index < chunks.length; index += chunkBatchSize) {
      const batch = chunks.slice(index, index + chunkBatchSize)
      await prisma.cloudBackupChunk.createMany({ data: batch })
      const uploadedChunkCount = Math.min(index + batch.length, chunks.length)
      const completedBatches = Math.ceil(uploadedChunkCount / chunkBatchSize)
      await prisma.cloudBackup.update({
        where: { id: backupId },
        data: {
          progressPercent:
            80 + Math.floor((completedBatches / chunkBatchCount) * 19),
          progressMessage: `Saving encrypted chunks (${uploadedChunkCount}/${chunks.length})`,
        },
      })
    }
    await prisma.$transaction(
      async (transaction) => {
        await transaction.cloudBackup.update({
          where: { id: backupId },
          data: {
            checksum,
            chunkCount,
            compressedBytes: compressed.length,
            originalBytes: snapshotBytes.length,
            recordCount,
            progressPercent: 100,
            progressMessage: "Backup complete",
            status: "COMPLETED",
            completedAt,
          },
        })
        if (userId) {
          await transaction.auditLog.create({
            data: {
              businessId,
              userId,
              action:
                triggerType === "AUTO"
                  ? "SERVER_BACKUP_AUTO_CREATED"
                  : "SERVER_BACKUP_CREATED",
              tableName: "CloudBackup",
              recordId: backupId,
            },
          })
        }
        const retained = await transaction.cloudBackup.findMany({
          where: {
            businessId,
            backupType: "SERVER",
            status: "COMPLETED",
          },
          orderBy: { completedAt: "desc" },
          take: retainedBackups,
          select: { id: true },
        })
        await transaction.cloudBackup.deleteMany({
          where: {
            businessId,
            backupType: "SERVER",
            status: "COMPLETED",
            id: { notIn: retained.map((item) => item.id) },
          },
        })
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    return {
      id: backupId,
      checksum,
      chunkCount,
      compressedBytes: compressed.length,
      originalBytes: snapshotBytes.length,
      recordCount,
      triggerType,
      retryCount: 0,
      progressPercent: 100,
      progressMessage: "Backup complete",
      status: "COMPLETED",
      completedAt: completedAt.toISOString(),
    }
  } catch (error) {
    const failureReason =
      error instanceof CloudBackupEncryptionError
        ? error.message
        : error instanceof Error && error.message.includes("backup limit")
          ? error.message
          : "Backup failed. Check server logs and retry."
    try {
      await prisma.cloudBackupChunk.deleteMany({ where: { backupId } })
    } catch (cleanupError) {
      console.error(
        "Unable to remove incomplete server backup chunks.",
        cleanupError,
      )
    }
    await prisma.cloudBackup.update({
      where: { id: backupId },
      data: {
        status: "FAILED",
        failureReason,
        progressMessage: "Backup failed",
      },
    })
    throw error
  }
}
