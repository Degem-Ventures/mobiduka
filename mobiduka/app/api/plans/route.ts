import { NextResponse } from "next/server.js"
import { platformMpesaCheckoutAvailable } from "@/lib/platform-mpesa"
import { prisma } from "@/lib/prisma"

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Plan feature data is invalid.")
  }
  return value
}

export async function GET() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        publicMonthlyPriceKsh: true,
        annualPriceKsh: true,
        subtitle: true,
        audience: true,
        color: true,
        marketingFeatures: true,
        featured: true,
        cta: true,
        onlineCheckoutEnabled: true,
      },
    })
    return NextResponse.json(
      {
        plans: plans.map((plan) => ({
          ...plan,
          marketingFeatures: stringList(plan.marketingFeatures),
          onlineCheckoutEnabled:
            plan.onlineCheckoutEnabled &&
            plan.publicMonthlyPriceKsh !== null &&
            platformMpesaCheckoutAvailable(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Public subscription plan catalog failed:", error)
    return NextResponse.json(
      { error: "Unable to load subscription plans." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
