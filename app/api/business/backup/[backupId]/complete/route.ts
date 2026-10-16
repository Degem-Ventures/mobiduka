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

export const runtime = "nodejs"

const maxOriginalBytes = 256 * 1024 * 1024
const chunkSize = 256 * 1024
const retainedBackups = 10
const backupIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ backupId: string }> }

class BackupIntegrityError extends Error {}

export async function POST(request: Request, context: RouteContext) {
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
            "Business settings permission is required to create cloud backups.",
        },
        { status: 403 },
      )
    }

    const { backupId } = await context.params
    let retryCount = 0
    if (request.body) {
      const body: unknown = await request.json()
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !Number.isInteger((body as Record<string, unknown>).retryCount) ||
        Number((body as Record<string, unknown>).retryCount) < 0 ||
        Number((body as Record<string, unknown>).retryCount) > 512
      ) {
        return NextResponse.json({ error: "Backup retry count is invalid." }, {
          status: 400,
        })
      }
      retryCount = Number((body as Record<string, unknown>).retryCount)
    }
    if (!backupIdPattern.test(backupId)) {
      return NextResponse.json({ error: "Backup ID is invalid." }, {
        status: 400,
      })
    }
    const backup = await prisma.cloudBackup.findFirst({
      where: { id: backupId, businessId, backupType: "DEVICE" },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
        },
      },
    })
    if (!backup) {
      return NextResponse.json({ error: "Cloud backup was not found." }, {
        status: 404,
      })
    }
    if (backup.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        backupId,
        checksum: backup.checksum,
        alreadyCompleted: true,
      })
    }
    if (backup.status !== "PENDING") {
      return NextResponse.json({ error: "Cloud backup cannot be completed." }, {
        status: 409,
      })
    }
    if (backup.chunks.length !== backup.chunkCount) {
      return NextResponse.json(
        {
          error: "Cloud backup is incomplete; one or more chunks are missing.",
        },
        { status: 409 },
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
          backupId,
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
        return NextResponse.json(
          {
            error:
              "Cloud backup archive is invalid or exceeds the supported size.",
          },
          { status: 400 },
        )
      }
      if (snapshotBytes.length !== backup.originalBytes) {
        return NextResponse.json(
          {
            error:
              "Cloud backup uncompressed size does not match its manifest.",
          },
          { status: 400 },
        )
      }
      const checksum = crypto
        .createHash("sha256")
        .update(snapshotBytes)
        .digest("hex")
      if (checksum !== backup.checksum) {
        return NextResponse.json(
          { error: "Cloud backup checksum verification failed." },
          { status: 400 },
        )
      }

      let snapshot: unknown
      try {
        snapshot = (JSON.parse(snapshotBytes.toString("utf8")) as unknown)
      } catch {
        return NextResponse.json(
          { error: "Cloud backup snapshot is invalid JSON." },
          { status: 400 },
        )
      }
      if (
        !snapshot ||
        typeof snapshot !== "object" ||
        (snapshot as Record<string, unknown>).formatVersion !== 1 ||
        (snapshot as Record<string, unknown>).businessId !== businessId ||
        !Array.isArray((snapshot as Record<string, unknown>).collections) ||
        !Array.isArray((snapshot as Record<string, unknown>).queuedRecords)
      ) {
        return NextResponse.json(
          {
            error:
              "Cloud backup snapshot does not match this business or its supported format.",
          },
          { status: 400 },
        )
      }
    } catch (error) {
      if (error instanceof CloudBackupEncryptionError) {
        return NextResponse.json({ error: error.message }, {
          status: error.kind === "configuration" ? 503 : 400,
        })
      }
      if (error instanceof BackupIntegrityError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.cloudBackup.updateMany({
        where: { id: backupId, businessId, status: "PENDING" },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          retryCount,
          failureReason: null,
        },
      })
      if (updated.count === 0) {
        const existing = await transaction.cloudBackup.findFirst({
          where: { id: backupId, businessId, status: "COMPLETED" },
          select: { id: true },
        })
        if (!existing) throw new Error("Cloud backup completion state changed.")
      }
      const retained = await transaction.cloudBackup.findMany({
        where: { businessId, backupType: "DEVICE", status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: retainedBackups,
        select: { id: true },
      })
      await transaction.cloudBackup.deleteMany({
        where: {
          businessId,
          backupType: "DEVICE",
          status: "COMPLETED",
          id: { notIn: retained.map((item) => item.id) },
        },
      })
    })

    return NextResponse.json({
      success: true,
      backupId,
      checksum: backup.checksum,
    })
  } catch (error) {
    console.error("Unable to verify and complete cloud backup.", error)
    return NextResponse.json(
      { error: "Unable to verify and complete cloud backup." },
      { status: 500 },
    )
  }
}
