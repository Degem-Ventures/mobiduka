import crypto from "node:crypto"
import { gunzipSync } from "node:zlib"
import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import {
  CloudBackupEncryptionError,
  decryptCloudBackupChunk,
  validateCloudBackupEncryptionKey,
} from "@/lib/cloud-backup-crypto"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"
import {
  restoreServerBusinessBackupSnapshot,
  validateServerBusinessBackupSnapshot,
} from "@/lib/server-business-backup"

export const runtime = "nodejs"
export const maxDuration = 60

const chunkSize = 256 * 1024
const maxCompressedBytes = 64 * 1024 * 1024
const maxOriginalBytes = 256 * 1024 * 1024
const backupIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class BackupIntegrityError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBusinessPermission(
      request,
      businessId,
      "settings",
    )
    if (!access) {
      return NextResponse.json(
        {
          error: "Business settings permission is required for server restore.",
        },
        { status: 403 },
      )
    }
    const backupId = new URL(request.url).searchParams.get("backupId")
    if (!backupId || !backupIdPattern.test(backupId)) {
      return NextResponse.json(
        { error: "A valid server backup ID is required." },
        { status: 400 },
      )
    }
    const restoreProgress = await prisma.cloudBackup.findFirst({
      where: {
        id: backupId,
        businessId,
        backupType: "SERVER",
        status: "COMPLETED",
        restoreStartedAt: { not: null },
      },
      select: {
        id: true,
        restoreProgressPercent: true,
        restoreProgressMessage: true,
      },
    })
    return NextResponse.json({ restoreProgress }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Unable to load server business restore progress.", error)
    return NextResponse.json(
      { error: "Unable to load server restore progress." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

export async function POST(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBusinessPermission(
      request,
      businessId,
      "settings",
    )
    if (!access) {
      return NextResponse.json(
        {
          error: "Business settings permission is required for server restore.",
        },
        { status: 403 },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Restore request must be valid JSON." },
        {
          status: 400,
        },
      )
    }
    if (
      !isRecord(body) ||
      typeof body.backupId !== "string" ||
      !backupIdPattern.test(body.backupId)
    ) {
      return NextResponse.json(
        { error: "A valid server backup ID is required." },
        {
          status: 400,
        },
      )
    }

    const backup = await prisma.cloudBackup.findFirst({
      where: {
        id: body.backupId,
        businessId,
        backupType: "SERVER",
        status: "COMPLETED",
      },
      select: {
        id: true,
        checksum: true,
        chunkCount: true,
        compressedBytes: true,
        originalBytes: true,
        chunks: {
          orderBy: { chunkIndex: "asc" },
          select: {
            chunkIndex: true,
            plaintextChecksum: true,
            nonce: true,
            authTag: true,
            ciphertext: true,
          },
        },
      },
    })
    if (!backup) {
      return NextResponse.json(
        { error: "No completed server backup was found for this business." },
        { status: 404 },
      )
    }
    if (
      !/^[a-f\d]{64}$/i.test(backup.checksum) ||
      !Number.isInteger(backup.chunkCount) ||
      backup.chunkCount < 1 ||
      backup.chunkCount > maxCompressedBytes / chunkSize ||
      !Number.isInteger(backup.compressedBytes) ||
      backup.compressedBytes < 1 ||
      backup.compressedBytes > maxCompressedBytes ||
      backup.chunkCount !== Math.ceil(backup.compressedBytes / chunkSize) ||
      !Number.isInteger(backup.originalBytes) ||
      backup.originalBytes < 1 ||
      backup.originalBytes > maxOriginalBytes ||
      backup.chunks.length !== backup.chunkCount
    ) {
      return NextResponse.json(
        { error: "Server backup manifest is invalid." },
        {
          status: 422,
        },
      )
    }

    const restoreStartedAt = new Date()
    const restoreLock = await prisma.cloudBackup.updateMany({
      where: {
        id: backup.id,
        OR: [
          { restoreStartedAt: null },
          {
            restoreStartedAt: {
              lt: new Date(Date.now() - 2 * 60 * 1000),
            },
          },
        ],
      },
      data: {
        restoreStartedAt,
        restoreProgressPercent: 1,
        restoreProgressMessage: "Reading encrypted backup",
      },
    })
    if (restoreLock.count !== 1) {
      return NextResponse.json(
        { error: "A restore is already in progress for this backup." },
        { status: 409 },
      )
    }
    const updateRestoreProgress = async (
      progressPercent: number,
      progressMessage: string,
    ) => {
      const result = await prisma.cloudBackup.updateMany({
        where: { id: backup.id, restoreStartedAt },
        data: {
          restoreProgressPercent: progressPercent,
          restoreProgressMessage: progressMessage,
        },
      })
      if (result.count !== 1) {
        throw new Error("Server restore progress session expired.")
      }
    }

    try {
      validateCloudBackupEncryptionKey()
      let lastDecryptProgress = 1
      const chunks = []
      for (const [index, chunk] of backup.chunks.entries()) {
        if (chunk.chunkIndex !== index) {
          throw new BackupIntegrityError(
            "Server backup chunk sequence is invalid.",
          )
        }
        const plaintext = decryptCloudBackupChunk(
          businessId,
          backup.id,
          index,
          backup.checksum,
          chunk,
        )
        const expectedBytes = Math.min(
          chunkSize,
          backup.compressedBytes - index * chunkSize,
        )
        const chunkChecksum = crypto
          .createHash("sha256")
          .update(plaintext)
          .digest("hex")
        if (
          plaintext.length !== expectedBytes ||
          chunkChecksum !== chunk.plaintextChecksum
        ) {
          throw new BackupIntegrityError(
            "Server backup chunk integrity validation failed.",
          )
        }
        const progressPercent =
          2 + Math.floor(((index + 1) / backup.chunkCount) * 13)
        if (progressPercent > lastDecryptProgress) {
          await updateRestoreProgress(
            progressPercent,
            `Decrypting backup chunks (${index + 1}/${backup.chunkCount})`,
          )
          lastDecryptProgress = progressPercent
        }
        chunks.push(plaintext)
      }
      const compressed = Buffer.concat(chunks)
      if (compressed.length !== backup.compressedBytes) {
        throw new BackupIntegrityError(
          "Server backup archive size validation failed.",
        )
      }
      let snapshotBytes: Buffer
      try {
        snapshotBytes = gunzipSync(compressed, {
          maxOutputLength: maxOriginalBytes,
        })
      } catch {
        throw new BackupIntegrityError(
          "Server backup archive is invalid or exceeds the supported size.",
        )
      }
      const checksum = crypto
        .createHash("sha256")
        .update(snapshotBytes)
        .digest("hex")
      if (
        snapshotBytes.length !== backup.originalBytes ||
        checksum !== backup.checksum
      ) {
        throw new BackupIntegrityError(
          "Server backup checksum or snapshot size validation failed.",
        )
      }

      let snapshot: unknown
      try {
        snapshot = (JSON.parse(snapshotBytes.toString("utf8")) as unknown)
      } catch {
        throw new BackupIntegrityError(
          "Server backup snapshot is invalid JSON.",
        )
      }
      if (!validateServerBusinessBackupSnapshot(snapshot, businessId)) {
        throw new BackupIntegrityError(
          "Server backup snapshot is invalid or belongs to another business.",
        )
      }

      await updateRestoreProgress(20, "Restoring business records")
      let lastRestoreProgressPercent = 20
      let lastRestoreProgressTable = ""
      const restoredRows = await prisma.$transaction(
        async (transaction) => {
          const counts = await restoreServerBusinessBackupSnapshot(
            transaction,
            snapshot,
            async (completed, total, tableName) => {
              const progressPercent = 20 + Math.floor((completed / total) * 79)
              if (
                progressPercent > lastRestoreProgressPercent ||
                tableName !== lastRestoreProgressTable
              ) {
                await updateRestoreProgress(
                  progressPercent,
                  `Restoring ${tableName} records (${completed}/${total})`,
                )
                lastRestoreProgressPercent = progressPercent
                lastRestoreProgressTable = tableName
              }
            },
          )
          await transaction.auditLog.create({
            data: {
              businessId,
              userId: access.userId,
              action: "SERVER_BACKUP_RESTORED",
              tableName: "CloudBackup",
              recordId: backup.id,
            },
          })
          return counts
        },
        { isolationLevel: "Serializable", timeout: 60_000, maxWait: 10_000 },
      )
      await updateRestoreProgress(100, "Restore complete")
      return NextResponse.json({
        success: true,
        backupId: backup.id,
        checksum: backup.checksum,
        restoredRows,
        conflictPolicy: "snapshot-wins",
        retainedCurrentOnlyRows: true,
      })
    } catch (error) {
      if (error instanceof CloudBackupEncryptionError) {
        return NextResponse.json({ error: error.message }, {
          status: error.kind === "configuration" ? 503 : 422,
        })
      }
      if (error instanceof BackupIntegrityError) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      throw error
    } finally {
      try {
        await prisma.cloudBackup.updateMany({
          where: { id: backup.id, restoreStartedAt },
          data: {
            restoreStartedAt: null,
            restoreProgressPercent: null,
            restoreProgressMessage: null,
          },
        })
      } catch (cleanupError) {
        console.error(
          "Unable to clear server business restore progress.",
          cleanupError,
        )
      }
    }
  } catch (error) {
    console.error("Unable to restore server business backup.", error)
    if (isRecord(error) && typeof error.code === "string") {
      const meta = isRecord(error.meta) ? error.meta : {}
      if (error.code === "P2002" || error.code === "P2010") {
        const databaseCode =
          error.code === "P2010" && typeof meta.code === "string"
            ? meta.code
            : null
        const isUniqueConflict =
          error.code === "P2002" || databaseCode === "23505"
        const isRelationConflict =
          error.code === "P2010" && databaseCode === "23503"
        const model = typeof meta.modelName === "string" ? meta.modelName : null
        const target = meta.target
        const fields = (Array.isArray(target) ? target : [target])
          .filter((field): field is string => typeof field === "string")
          .map((field) => field.replace(/[^a-zA-Z0-9_.]/g, ""))
          .filter(Boolean)
        const message = typeof meta.message === "string" ? meta.message : ""
        const constraint = message.match(/constraint "([^"]+)"/)?.[1]
        const safeConstraint = constraint?.replace(/[^a-zA-Z0-9_.]/g, "")
        const location =
          model && fields.length
            ? `${model} (${fields.join(", ")})`
            : (model ?? fields.join(", ") ?? safeConstraint)
        if (isUniqueConflict) {
          return NextResponse.json(
            {
              error: `Restore rolled back because a unique value conflicts with another record${
                location || safeConstraint
                  ? ` in ${location || safeConstraint}`
                  : ""
              }. No rows were committed. Resolve the conflict and retry.`,
            },
            { status: 409 },
          )
        }
        if (isRelationConflict) {
          return NextResponse.json(
            {
              error:
                "Restore rolled back because a record has a conflicting relationship. No rows were committed; resolve the related records and retry.",
            },
            { status: 409 },
          )
        }
        if (error.code === "P2010") {
          return NextResponse.json(
            {
              error: `Restore rolled back because the database rejected a snapshot row${
                databaseCode ? ` (database error ${databaseCode})` : ""
              }. No rows were committed. Check that the backup matches the current database schema.`,
            },
            { status: 409 },
          )
        }
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Restore rolled back because a record has a conflicting relationship. No rows were committed; resolve the related records and retry.",
          },
          { status: 409 },
        )
      }
      if (error.code === "P2034") {
        return NextResponse.json(
          {
            error:
              "Restore was rolled back because another database transaction conflicted. No rows were committed; retry the restore.",
          },
          { status: 409 },
        )
      }
      if (error.code === "P2028") {
        return NextResponse.json(
          {
            error:
              "Restore rolled back because the database transaction expired before it finished. No rows were committed; retry after confirming the server has the latest restore update.",
          },
          { status: 503 },
        )
      }
    }
    return NextResponse.json(
      {
        error:
          "Unable to restore server business backup. No rows were committed; check for ID or unique-field conflicts.",
      },
      { status: 500 },
    )
  }
}
