import crypto from "node:crypto"
import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import {
  CloudBackupEncryptionError,
  encryptCloudBackupChunk,
  validateCloudBackupEncryptionKey,
} from "@/lib/cloud-backup-crypto"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"

const chunkSize = 256 * 1024
const backupIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = {
  params: Promise<{ backupId: string; index: string }>
}

async function readChunk(request: Request) {
  const chunks: Buffer[] = []
  let totalBytes = 0
  const reader = request.body?.getReader()
  if (!reader) return Buffer.alloc(0)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > chunkSize) {
        await reader.cancel()
        throw new RangeError("Backup chunk exceeds the maximum allowed size.")
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, totalBytes)
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const businessId = authenticatedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBusinessPermission(request, businessId, "settings")
    if (!access) {
      return NextResponse.json(
        { error: "Business settings permission is required to create cloud backups." },
        { status: 403 },
      )
    }

    const { backupId, index: rawIndex } = await context.params
    const chunkIndex = Number(rawIndex)
    if (
      !backupIdPattern.test(backupId) ||
      !/^(0|[1-9]\d*)$/.test(rawIndex) ||
      !Number.isSafeInteger(chunkIndex)
    ) {
      return NextResponse.json({ error: "Backup chunk address is invalid." }, { status: 400 })
    }

    const backup = await prisma.cloudBackup.findFirst({
      where: { id: backupId, businessId },
      select: {
        checksum: true,
        chunkCount: true,
        compressedBytes: true,
        status: true,
        backupType: true,
      },
    })
    if (!backup) {
      return NextResponse.json({ error: "Cloud backup was not found." }, { status: 404 })
    }
    if (backup.backupType !== "DEVICE") {
      return NextResponse.json({ error: "This backup does not accept device-uploaded chunks." }, { status: 409 })
    }
    if (chunkIndex >= backup.chunkCount) {
      return NextResponse.json({ error: "Backup chunk index is out of range." }, { status: 400 })
    }

    const chunk = await readChunk(request)
    const expectedBytes = Math.min(
      chunkSize,
      backup.compressedBytes - chunkIndex * chunkSize,
    )
    if (chunk.length !== expectedBytes) {
      return NextResponse.json(
        { error: "Backup chunk size does not match the declared archive." },
        { status: 400 },
      )
    }
    const plaintextChecksum = crypto.createHash("sha256").update(chunk).digest("hex")
    const existing = await prisma.cloudBackupChunk.findUnique({
      where: { backupId_chunkIndex: { backupId, chunkIndex } },
      select: { plaintextChecksum: true },
    })
    if (existing) {
      if (existing.plaintextChecksum !== plaintextChecksum) {
        return NextResponse.json(
          { error: "This backup chunk was already uploaded with different data." },
          { status: 409 },
        )
      }
      return NextResponse.json({ success: true, chunkIndex, alreadyStored: true })
    }
    if (backup.status !== "PENDING") {
      return NextResponse.json(
        { error: "Completed backups cannot accept additional chunks." },
        { status: 409 },
      )
    }

    try {
      validateCloudBackupEncryptionKey()
      const encrypted = encryptCloudBackupChunk(
        businessId,
        backupId,
        chunkIndex,
        backup.checksum,
        chunk,
      )
      try {
        await prisma.cloudBackupChunk.create({
          data: {
            backupId,
            chunkIndex,
            plaintextChecksum,
            ...encrypted,
          },
        })
      } catch (error) {
        const duplicate = await prisma.cloudBackupChunk.findUnique({
          where: { backupId_chunkIndex: { backupId, chunkIndex } },
          select: { plaintextChecksum: true },
        })
        if (duplicate?.plaintextChecksum === plaintextChecksum) {
          return NextResponse.json({ success: true, chunkIndex, alreadyStored: true })
        }
        throw error
      }
    } catch (error) {
      if (error instanceof CloudBackupEncryptionError) {
        return NextResponse.json({ error: error.message }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ success: true, chunkIndex })
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    console.error("Unable to store cloud backup chunk.", error)
    return NextResponse.json(
      { error: "Unable to store cloud backup chunk." },
      { status: 500 },
    )
  }
}
