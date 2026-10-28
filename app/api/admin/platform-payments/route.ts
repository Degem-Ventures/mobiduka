import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"

export async function GET(request: Request) {
  if (!await requirePlatformAdmin(request)) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 })
  }

  try {
    const payments = await prisma.platformPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        planName: true,
        amountKsh: true,
        phoneNumber: true,
        status: true,
        reportedAmountKsh: true,
        resultDescription: true,
        receiptNumber: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({
      payments: payments.map((payment) => ({
        ...payment,
        phoneNumber: `****${payment.phoneNumber.slice(-4)}`,
      })),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Platform payment ledger load failed:", error)
    return NextResponse.json({ error: "Unable to load subscription payments." }, { status: 500 })
  }
}
