import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"

const noStore = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  if (!await requirePlatformAdmin(request)) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403, headers: noStore })
  }

  try {
    const [messages, total, newCount, readCount, resolvedCount] = await Promise.all([
      prisma.websiteContactMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.websiteContactMessage.count(),
      prisma.websiteContactMessage.count({ where: { status: "NEW" } }),
      prisma.websiteContactMessage.count({ where: { status: "READ" } }),
      prisma.websiteContactMessage.count({ where: { status: "RESOLVED" } }),
    ])
    return NextResponse.json({
      messages,
      total,
      metrics: { new: newCount, read: readCount, resolved: resolvedCount },
    }, { headers: noStore })
  } catch (error) {
    console.error("Platform contact inbox load failed:", error)
    return NextResponse.json({ error: "Unable to load website contact messages." }, { status: 500, headers: noStore })
  }
}

export async function PATCH(request: Request) {
  if (!await requirePlatformAdmin(request)) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403, headers: noStore })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore })
  }
  const id = typeof body.id === "string" ? body.id.trim() : ""
  const status = body.status
  if (!id || (status !== "READ" && status !== "RESOLVED")) {
    return NextResponse.json({ error: "A message ID and valid status are required." }, { status: 400, headers: noStore })
  }

  try {
    const result = await prisma.websiteContactMessage.updateMany({
      where: { id },
      data: { status },
    })
    if (!result.count) {
      return NextResponse.json({ error: "Contact message was not found." }, { status: 404, headers: noStore })
    }
    const message = await prisma.websiteContactMessage.findUnique({ where: { id } })
    return NextResponse.json({ message }, { headers: noStore })
  } catch (error) {
    console.error("Platform contact message update failed:", error)
    return NextResponse.json({ error: "Unable to update contact message." }, { status: 500, headers: noStore })
  }
}
