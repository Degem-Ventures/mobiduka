import crypto from "node:crypto"
import { NextResponse } from "next/server.js"
import { gunzipSync } from "node:zlib"
import { authenticatedBusinessId } from "@/lib/auth"
import {
  CloudBackupEncryptionError,
  decryptCloudBackupChunk,
  validateCloudBackupEncryptionKey,
} from "@/lib/cloud-backup-crypto"
import { prisma } from "@/lib/prisma"
import { subscriptionWriteLockResponse } from "@/lib/subscription-write-guard"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"

const chunkSize = 256 * 1024
const maxCompressedBytes = 64 * 1024 * 1024
const maxOriginalBytes = 256 * 1024 * 1024
const maxChunks = maxCompressedBytes / chunkSize
const backupIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RestoreRequest = { backupId?: unknown }
type SnapshotRecord = Record<string, unknown>

class BackupIntegrityError extends Error {}

function isRecord(value: unknown): value is SnapshotRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isSupportedSnapshot(value: unknown, businessId: string) {
  if (!isRecord(value)) return false
  if (
    value.formatVersion !== 1 ||
    value.businessId !== businessId ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Array.isArray(value.collections) ||
    !Array.isArray(value.queuedRecords)
  ) {
    return false
  }

  const cacheKeys = new Set<string>()
  for (const collection of value.collections) {
    if (
      !isRecord(collection) ||
      typeof collection.cacheKey !== "string" ||
      collection.cacheKey.length === 0 ||
      collection.cacheKey.length > 512 ||
      typeof collection.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(collection.updatedAt)) ||
      !Object.prototype.hasOwnProperty.call(collection, "payload") ||
      cacheKeys.has(collection.cacheKey)
    ) {
      return false
    }
    cacheKeys.add(collection.cacheKey)
  }

  const recordIds = new Set<string>()
  for (const record of value.queuedRecords) {
    if (
      !isRecord(record) ||
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      typeof record.entityName !== "string" ||
      record.entityName.length === 0 ||
      typeof record.operation !== "string" ||
      typeof record.externalId !== "string" ||
      typeof record.payloadHash !== "string" ||
      !/^[a-f\d]{64}$/i.test(record.payloadHash) ||
      (record.status !== "PENDING" && record.status !== "FAILED") ||
      !Number.isSafeInteger(record.attemptCount) ||
      Number(record.attemptCount) < 0 ||
      (record.nextRetryAt !== null && typeof record.nextRetryAt !== "string") ||
      typeof record.createdAt !== "string" ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      !Object.prototype.hasOwnProperty.call(record, "payload") ||
      recordIds.has(record.id)
    ) {
      return false
    }
    recordIds.add(record.id)
  }
  return true
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
          error:
            "Business settings permission is required to restore cloud backups.",
        },
        { status: 403 },
      )
    }
    const subscriptionLock = await subscriptionWriteLockResponse(businessId)
    if (subscriptionLock) return subscriptionLock

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Restore request must be valid JSON." },
        { status: 400 },
      )
    }
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Restore request must be a JSON object." },
        { status: 400 },
      )
    }
    const { backupId } = body as RestoreRequest
    if (
      backupId !== undefined &&
      (typeof backupId !== "string" || !backupIdPattern.test(backupId))
    ) {
      return NextResponse.json({ error: "Backup ID is invalid." }, {
        status: 400,
      })
    }

    const backup = await prisma.cloudBackup.findFirst({
      where: {
        businessId,
        backupType: "DEVICE",
        status: "COMPLETED",
        ...(typeof backupId === "string" ? { id: backupId } : {}),
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        checksum: true,
        chunkCount: true,
        compressedBytes: true,
        originalBytes: true,
        completedAt: true,
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
        { error: "No completed cloud backup was found for this business." },
        { status: 404 },
      )
    }
    if (
      !/^[a-f\d]{64}$/i.test(backup.checksum) ||
      !Number.isInteger(backup.chunkCount) ||
      backup.chunkCount < 1 ||
      backup.chunkCount > maxChunks ||
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
        { error: "Cloud backup manifest or chunk sequence is invalid." },
        { status: 422 },
      )
    }

    try {
      validateCloudBackupEncryptionKey()
      const compressedChunks = backup.chunks.map((chunk, index) => {
        if (chunk.chunkIndex !== index) {
          throw new BackupIntegrityError(
            "Cloud backup chunk sequence is invalid.",
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
            "Cloud backup chunk integrity check failed.",
          )
        }
        return plaintext
      })
      const compressed = Buffer.concat(compressedChunks)
      if (compressed.length !== backup.compressedBytes) {
        throw new BackupIntegrityError(
          "Cloud backup archive size does not match its manifest.",
        )
      }

      let snapshotBytes: Buffer
      try {
        snapshotBytes = gunzipSync(compressed, {
          maxOutputLength: maxOriginalBytes,
        })
      } catch {
        throw new BackupIntegrityError(
          "Cloud backup archive is invalid or exceeds the supported size.",
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
          "Cloud backup checksum or archive size verification failed.",
        )
      }

      let snapshot: unknown
      try {
        snapshot = (JSON.parse(snapshotBytes.toString("utf8")) as unknown)
      } catch {
        throw new BackupIntegrityError("Cloud backup snapshot is invalid JSON.")
      }
      if (!isSupportedSnapshot(snapshot, businessId)) {
        throw new BackupIntegrityError(
          "Cloud backup snapshot does not match this business or its supported format.",
        )
      }

      return NextResponse.json({
        success: true,
        backupId: backup.id,
        checksum: backup.checksum,
        completedAt: backup.completedAt?.toISOString() ?? null,
        payload: snapshot,
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
    }
  } catch (error) {
    console.error("Unable to restore cloud backup.", error)
    return NextResponse.json({ error: "Unable to restore cloud backup." }, {
      status: 500,
    })
  }
}
