import { NextResponse } from "next/server.js"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"

const planNames = ["Basic", "Growth", "Enterprise"] as const
const colors = ["blue", "green", "gold"] as const

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 20 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 120)
}

export async function GET(request: Request) {
  if (!await requirePlatformAdmin(request)) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 })
  }

  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } })
    return NextResponse.json({ plans }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Platform plan catalog load failed:", error)
    return NextResponse.json({ error: "Unable to load subscription plans." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!await requirePlatformAdmin(request)) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const name = body.name
    const monthlyPriceKsh = body.monthlyPriceKsh
    const publicMonthlyPriceKsh = body.publicMonthlyPriceKsh
    const annualPriceKsh = body.annualPriceKsh
    if (
      typeof name !== "string" ||
      !planNames.includes(name as typeof planNames[number]) ||
      !Number.isSafeInteger(monthlyPriceKsh) ||
      Number(monthlyPriceKsh) < 1 ||
      (publicMonthlyPriceKsh !== null &&
        (!Number.isSafeInteger(publicMonthlyPriceKsh) || Number(publicMonthlyPriceKsh) < 1)) ||
      (annualPriceKsh !== null &&
        (!Number.isSafeInteger(annualPriceKsh) || Number(annualPriceKsh) < 1)) ||
      typeof body.subtitle !== "string" || !body.subtitle.trim() || body.subtitle.length > 100 ||
      typeof body.audience !== "string" || !body.audience.trim() || body.audience.length > 120 ||
      typeof body.color !== "string" || !colors.includes(body.color as typeof colors[number]) ||
      !isStringList(body.adminFeatures) ||
      !isStringList(body.marketingFeatures) ||
      typeof body.featured !== "boolean" ||
      typeof body.onlineCheckoutEnabled !== "boolean" ||
      typeof body.isActive !== "boolean" ||
      typeof body.cta !== "string" || !body.cta.trim() || body.cta.length > 60
    ) {
      return NextResponse.json({ error: "Plan details are invalid." }, { status: 400 })
    }

    if (body.onlineCheckoutEnabled && publicMonthlyPriceKsh === null) {
      return NextResponse.json(
        { error: "Set an approved public monthly price before enabling online checkout." },
        { status: 400 },
      )
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { name },
      data: {
        monthlyPriceKsh: Number(monthlyPriceKsh),
        publicMonthlyPriceKsh: publicMonthlyPriceKsh === null ? null : Number(publicMonthlyPriceKsh),
        annualPriceKsh: annualPriceKsh === null ? null : Number(annualPriceKsh),
        subtitle: body.subtitle.trim(),
        audience: body.audience.trim(),
        color: body.color,
        adminFeatures: body.adminFeatures as Prisma.InputJsonValue,
        marketingFeatures: body.marketingFeatures as Prisma.InputJsonValue,
        featured: body.featured,
        cta: body.cta.trim(),
        onlineCheckoutEnabled: body.onlineCheckoutEnabled,
        isActive: body.isActive,
      },
    })
    return NextResponse.json({ plan })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 })
    }
    console.error("Platform plan catalog update failed:", error)
    return NextResponse.json({ error: "Unable to update subscription plan." }, { status: 500 })
  }
}
