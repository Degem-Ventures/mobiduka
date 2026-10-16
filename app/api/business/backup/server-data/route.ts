import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import { CloudBackupEncryptionError } from "@/lib/cloud-backup-crypto"
import {
  createServerBusinessBackup,
  type BackupTrigger,
} from "@/lib/create-server-business-backup"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"
export const maxDuration = 60

async function authorizedBusiness(request: Request) {
  const businessId = authenticatedBusinessId(request)
  if (!businessId) {
    return {
      response: NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      ),
    }
  }
  const access = await requireBusinessPermission(
    request,
    businessId,
    "settings",
  )
  if (!access) {
    return {
      response: NextResponse.json(
        {
          error: "Business settings permission is required for server backups.",
        },
        { status: 403 },
      ),
    }
  }
  return { businessId, userId: access.userId }
}

export async function GET(request: Request) {
  try {
    const authorization = await authorizedBusiness(request)
    if ("response" in authorization) return authorization.response
    if (new URL(request.url).searchParams.get("progress") === "1") {
      const activeBackup = await prisma.cloudBackup.findFirst({
        where: {
          businessId: authorization.businessId,
          backupType: "SERVER",
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          progressPercent: true,
          progressMessage: true,
        },
      })
      return NextResponse.json(
        { activeBackup },
        { headers: { "Cache-Control": "no-store" } },
      )
    }
    const [latest, backups] = await Promise.all([
      prisma.cloudBackup.findFirst({
        where: {
          businessId: authorization.businessId,
          backupType: "SERVER",
          status: "COMPLETED",
        },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          checksum: true,
          chunkCount: true,
          compressedBytes: true,
          originalBytes: true,
          recordCount: true,
          triggerType: true,
          retryCount: true,
          completedAt: true,
          createdAt: true,
          status: true,
          failureReason: true,
          progressPercent: true,
          progressMessage: true,
        },
      }),
      prisma.cloudBackup.findMany({
        where: {
          businessId: authorization.businessId,
          backupType: "SERVER",
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
          recordCount: true,
          triggerType: true,
          retryCount: true,
          status: true,
          failureReason: true,
          progressPercent: true,
          progressMessage: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ])
    return NextResponse.json(
      {
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
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Unable to load server backup metadata.", error)
    return NextResponse.json(
      { error: "Unable to load server backup information." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizedBusiness(request)
    if ("response" in authorization) return authorization.response
    let body: { triggerType?: unknown } = {}
    if (request.body) {
      try {
        const parsed: unknown = await request.json()
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return NextResponse.json(
            { error: "Backup options must be a JSON object." },
            { status: 400 },
          )
        }
        body = (parsed as { triggerType?: unknown })
      } catch (error) {
        if (error instanceof SyntaxError) {
          return NextResponse.json(
            { error: "Backup options must be valid JSON." },
            { status: 400 },
          )
        }
        throw error
      }
    }
    if (
      body.triggerType !== undefined &&
      body.triggerType !== "AUTO" &&
      body.triggerType !== "MANUAL"
    ) {
      return NextResponse.json({ error: "Backup trigger type is invalid." }, {
        status: 400,
      })
    }
    const triggerType: BackupTrigger =
      body.triggerType === "AUTO" ? "AUTO" : "MANUAL"
    const backup = await createServerBusinessBackup(
      authorization.businessId,
      authorization.userId,
      triggerType,
    )
    return NextResponse.json({ success: true, backup }, { status: 201 })
  } catch (error) {
    console.error("Unable to create server business backup.", error)
    if (error instanceof CloudBackupEncryptionError) {
      return NextResponse.json({ error: error.message }, {
        status: error.kind === "configuration" ? 503 : 400,
      })
    }
    if (
      error instanceof Error &&
      error.message.includes("tenant integrity checks")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof Error && error.message.includes("backup limit")) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    return NextResponse.json(
      { error: "Unable to create server business backup." },
      { status: 500 },
    )
  }
}
