import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ backupId: string }> }

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
            "Business settings permission is required to update backup status.",
        },
        { status: 403 },
      )
    }
    const { backupId } = await context.params
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Backup failure details are invalid." },
        { status: 400 },
      )
    }
    const body = parsed as Record<string, unknown>
    const retryCount = body.retryCount ?? 0
    const failureReason = body.failureReason
    if (
      !Number.isInteger(retryCount) ||
      Number(retryCount) < 0 ||
      Number(retryCount) > 512 ||
      typeof failureReason !== "string" ||
      failureReason.length < 1 ||
      failureReason.length > 500
    ) {
      return NextResponse.json(
        { error: "Backup failure details are invalid." },
        { status: 400 },
      )
    }
    const updated = await prisma.cloudBackup.updateMany({
      where: {
        id: backupId,
        businessId,
        backupType: "DEVICE",
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        retryCount: Number(retryCount),
        failureReason: failureReason.trim(),
      },
    })
    if (updated.count === 0) {
      const existingFailure = await prisma.cloudBackup.findFirst({
        where: {
          id: backupId,
          businessId,
          backupType: "DEVICE",
          status: "FAILED",
        },
        select: { id: true },
      })
      if (existingFailure)
        return NextResponse.json({ success: true, alreadyFailed: true })
      return NextResponse.json(
        { error: "Pending device backup was not found." },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Backup failure details must be valid JSON." },
        { status: 400 },
      )
    }
    console.error("Unable to record failed device backup.", error)
    return NextResponse.json(
      { error: "Unable to record failed device backup." },
      { status: 500 },
    )
  }
}
