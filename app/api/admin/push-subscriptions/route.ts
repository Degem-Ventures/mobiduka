import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 401 })
  }

  let body: { token?: unknown }
  try {
    body = await request.json() as { token?: unknown }
  } catch {
    return NextResponse.json({ error: "A valid push token is required." }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token || token.length > 8192) {
    return NextResponse.json({ error: "A valid push token is required." }, { status: 400 })
  }

  try {
    await prisma.platformAdminNotificationSubscription.upsert({
      where: { token },
      update: { platformAdminId: admin.id },
      create: { platformAdminId: admin.id, token },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Platform admin push subscription could not be saved.", error)
    return NextResponse.json({ error: "Unable to save browser push subscription." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 401 })
  }

  let body: { token?: unknown }
  try {
    body = await request.json() as { token?: unknown }
  } catch {
    return NextResponse.json({ error: "A valid push token is required." }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token || token.length > 8192) {
    return NextResponse.json({ error: "A valid push token is required." }, { status: 400 })
  }

  await prisma.platformAdminNotificationSubscription.deleteMany({
    where: { platformAdminId: admin.id, token },
  })
  return NextResponse.json({ success: true })
}
