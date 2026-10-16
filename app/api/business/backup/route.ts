import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import {
  CloudBackupEncryptionError,
  validateCloudBackupEncryptionKey,
} from "@/lib/cloud-backup-crypto"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"

const maxChunkBytes = 256 * 1024
const maxCompressedBytes = 64 * 1024 * 1024
const maxOriginalBytes = 256 * 1024 * 1024
const maxChunks = maxCompressedBytes / maxChunkBytes
const backupIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type BackupRequest = {
  backupId?: unknown
  checksum?: unknown
  chunkCount?: unknown
  compressedBytes?: unknown
  originalBytes?: unknown
  collectionCount?: unknown
  queuedRecordCount?: unknown
  triggerType?: unknown
}

function authorizedBusinessId(request: Request) {
  return authenticatedBusinessId(request)
}

async function requireBackupAccess(request: Request, businessId: string) {
  return requireBusinessPermission(request, businessId, "settings")
}

export async function GET(request: Request) {
  try {
    const businessId = authorizedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBackupAccess(request, businessId)
    if (!access) {
      return NextResponse.json(
        {
          error:
            "Business settings permission is required to access cloud backups.",
        },
        { status: 403 },
      )
    }

    const [latest, backups] = await Promise.all([
      prisma.cloudBackup.findFirst({
        where: { businessId, backupType: "DEVICE", status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          checksum: true,
          chunkCount: true,
          compressedBytes: true,
          originalBytes: true,
          collectionCount: true,
          queuedRecordCount: true,
          triggerType: true,
          retryCount: true,
          status: true,
          failureReason: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.cloudBackup.findMany({
        where: {
          businessId,
          backupType: "DEVICE",
          status: { in: ["COMPLETED", "FAILED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          checksum: true,
          chunkCount: true,
          compressedBytes: true,
          originalBytes: true,
          collectionCount: true,
          queuedRecordCount: true,
          triggerType: true,
          retryCount: true,
          status: true,
          failureReason: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ])
    return NextResponse.json({
      backup: latest
        ? {
            ...latest,
            completedAt: latest.completedAt?.toISOString() ?? null,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
      backups: backups.map((backup) => ({
        ...backup,
        completedAt: backup.completedAt?.toISOString() ?? null,
        createdAt: backup.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Unable to load cloud backup metadata.", error)
    return NextResponse.json(
      { error: "Unable to load cloud backup information." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const businessId = authorizedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBackupAccess(request, businessId)
    if (!access) {
      return NextResponse.json(
        {
          error:
            "Business settings permission is required to create cloud backups.",
        },
        { status: 403 },
      )
    }

    const parsedBody: unknown = await request.json()
    if (
      !parsedBody ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      return NextResponse.json(
        { error: "Backup metadata must be a JSON object." },
        { status: 400 },
      )
    }
    const body = parsedBody as BackupRequest
    const {
      backupId,
      checksum,
      chunkCount,
      compressedBytes,
      originalBytes,
      collectionCount,
      queuedRecordCount,
      triggerType,
    } = body
    if (
      triggerType !== undefined &&
      triggerType !== "AUTO" &&
      triggerType !== "MANUAL"
    ) {
      return NextResponse.json({ error: "Backup trigger type is invalid." }, {
        status: 400,
      })
    }
    const normalizedTriggerType = triggerType === "AUTO" ? "AUTO" : "MANUAL"
    if (
      typeof backupId !== "string" ||
      !backupIdPattern.test(backupId) ||
      typeof checksum !== "string" ||
      !/^[a-f\d]{64}$/i.test(checksum) ||
      !Number.isInteger(chunkCount) ||
      Number(chunkCount) < 1 ||
      Number(chunkCount) > maxChunks ||
      !Number.isInteger(compressedBytes) ||
      Number(compressedBytes) < 1 ||
      Number(compressedBytes) > maxCompressedBytes ||
      Number(chunkCount) !==
        Math.ceil(Number(compressedBytes) / maxChunkBytes) ||
      !Number.isInteger(originalBytes) ||
      Number(originalBytes) < 1 ||
      Number(originalBytes) > maxOriginalBytes ||
      (collectionCount !== undefined &&
        (!Number.isInteger(collectionCount) ||
          Number(collectionCount) < 0 ||
          Number(collectionCount) > maxOriginalBytes)) ||
      (queuedRecordCount !== undefined &&
        (!Number.isInteger(queuedRecordCount) ||
          Number(queuedRecordCount) < 0 ||
          Number(queuedRecordCount) > maxOriginalBytes))
    ) {
      return NextResponse.json(
        {
          error:
            "Cloud backup metadata is invalid or exceeds the supported size.",
        },
        { status: 400 },
      )
    }

    await prisma.cloudBackup.deleteMany({
      where: {
        businessId,
        backupType: "DEVICE",
        triggerType: normalizedTriggerType,
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    await prisma.cloudBackup.deleteMany({
      where: {
        businessId,
        backupType: "DEVICE",
        status: "FAILED",
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    })
    const inserted = await prisma.cloudBackup.createMany({
      data: {
        id: backupId,
        businessId,
        backupType: "DEVICE",
        triggerType: normalizedTriggerType,
        checksum: checksum.toLowerCase(),
        chunkCount: Number(chunkCount),
        compressedBytes: Number(compressedBytes),
        originalBytes: Number(originalBytes),
        collectionCount:
          typeof collectionCount === "number" ? collectionCount : null,
        queuedRecordCount:
          typeof queuedRecordCount === "number" ? queuedRecordCount : null,
      },
      skipDuplicates: true,
    })
    const backup = await prisma.cloudBackup.findUnique({
      where: { id: backupId },
      select: {
        businessId: true,
        backupType: true,
        checksum: true,
        chunkCount: true,
        compressedBytes: true,
        originalBytes: true,
        collectionCount: true,
        queuedRecordCount: true,
        triggerType: true,
        status: true,
      },
    })
    if (!backup) {
      throw new Error(
        "Cloud backup initialization did not create a backup record.",
      )
    }
    const matches =
      backup.businessId === businessId &&
      backup.backupType === "DEVICE" &&
      backup.checksum === checksum.toLowerCase() &&
      backup.chunkCount === chunkCount &&
      backup.compressedBytes === compressedBytes &&
      backup.originalBytes === originalBytes &&
      backup.collectionCount ===
        (typeof collectionCount === "number" ? collectionCount : null) &&
      backup.queuedRecordCount ===
        (typeof queuedRecordCount === "number" ? queuedRecordCount : null) &&
      backup.triggerType === normalizedTriggerType
    if (!matches) {
      return NextResponse.json(
        {
          error: "Backup ID is already associated with different backup data.",
        },
        { status: 409 },
      )
    }
    if (backup.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        backupId,
        status: "COMPLETED",
        alreadyCompleted: true,
      })
    }
    if (backup.status !== "PENDING") {
      return NextResponse.json(
        { error: "This backup attempt is no longer available for upload." },
        { status: 409 },
      )
    }
    try {
      validateCloudBackupEncryptionKey()
    } catch (error) {
      if (error instanceof CloudBackupEncryptionError) {
        await prisma.cloudBackup.update({
          where: { id: backupId },
          data: {
            status: "FAILED",
            failureReason: error.message,
          },
        })
        return NextResponse.json({ error: error.message }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json(
      { success: true, backupId, status: backup.status },
      { status: inserted.count > 0 ? 201 : 200 },
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Backup metadata must be valid JSON." },
        { status: 400 },
      )
    }
    console.error("Unable to initialize cloud backup.", error)
    return NextResponse.json({ error: "Unable to initialize cloud backup." }, {
      status: 500,
    })
  }
}
