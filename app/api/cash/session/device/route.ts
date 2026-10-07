import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

const deviceUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function registerDevice(
  businessId: string,
  userId: string,
  deviceUuid: string,
) {
  const existing = await prisma.device.findUnique({
    where: { deviceUuid },
    select: { id: true, businessId: true, status: true },
  })
  if (existing && existing.businessId !== businessId) {
    return { error: "This device is registered to another business." } as const
  }
  if (existing?.status !== undefined && existing.status !== "ACTIVE") {
    return { error: "This device is inactive. Contact an administrator." } as const
  }

  const device = await prisma.device.upsert({
    where: { deviceUuid },
    create: {
      businessId,
      userId,
      deviceUuid,
      deviceName: "Web POS Device",
      platform: "web",
      lastSeen: new Date(),
    },
    update: { userId, lastSeen: new Date() },
    select: {
      id: true,
      currentCashSessionId: true,
      currentCashSession: {
        select: { id: true, closedAt: true, businessId: true },
      },
    },
  })
  return { device } as const
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const access = await requireBusinessPermission(
      request,
      url.searchParams.get("businessId"),
      "pos",
    )
    if (!access) {
      return NextResponse.json(
        { error: "POS permission is required." },
        { status: 403 },
      )
    }
    const deviceUuid = url.searchParams.get("deviceUuid")?.trim() ?? ""
    if (!deviceUuidPattern.test(deviceUuid)) {
      return NextResponse.json(
        { error: "A valid registered device identifier is required." },
        { status: 400 },
      )
    }

    const result = await registerDevice(
      access.businessId,
      access.userId,
      deviceUuid,
    )
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    let currentShiftId = result.device.currentCashSessionId
    if (
      result.device.currentCashSession &&
      (result.device.currentCashSession.closedAt ||
        result.device.currentCashSession.businessId !== access.businessId)
    ) {
      await prisma.device.update({
        where: { id: result.device.id },
        data: { currentCashSessionId: null },
      })
      currentShiftId = null
    }

    return NextResponse.json({
      deviceId: result.device.id,
      currentShiftId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load this device's current shift.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string
      deviceUuid?: string
      cashSessionId?: string | null
    }
    const access = await requireBusinessPermission(
      request,
      body.businessId,
      "pos",
    )
    if (!access) {
      return NextResponse.json(
        { error: "POS permission is required." },
        { status: 403 },
      )
    }
    const deviceUuid = body.deviceUuid?.trim() ?? ""
    if (!deviceUuidPattern.test(deviceUuid)) {
      return NextResponse.json(
        { error: "A valid registered device identifier is required." },
        { status: 400 },
      )
    }
    if (
      body.cashSessionId !== null &&
      (typeof body.cashSessionId !== "string" || !body.cashSessionId.trim())
    ) {
      return NextResponse.json(
        { error: "A valid current shift selection is required." },
        { status: 400 },
      )
    }

    const result = await registerDevice(
      access.businessId,
      access.userId,
      deviceUuid,
    )
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    const cashSessionId = body.cashSessionId?.trim() ?? null
    if (cashSessionId) {
      const shift = await prisma.cashSession.findFirst({
        where: {
          id: cashSessionId,
          businessId: access.businessId,
          closedAt: null,
          cashier: {
            status: "ACTIVE",
            role: { name: { in: ["CASHIER", "SUPERVISOR"] } },
          },
        },
        select: { id: true },
      })
      if (!shift) {
        return NextResponse.json(
          { error: "Select an active shift for this business." },
          { status: 400 },
        )
      }
    }

    await prisma.device.update({
      where: { id: result.device.id },
      data: { currentCashSessionId: cashSessionId },
    })
    return NextResponse.json({ success: true, currentShiftId: cashSessionId })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to save this device's current shift.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
