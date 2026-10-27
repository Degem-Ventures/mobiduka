import { NextResponse } from "next/server.js"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"
import { effectiveSubscriptionStatus } from "@/lib/subscriptions"

const pageSize = 50

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const params = new URL(request.url).searchParams
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10)
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(1_000_000, Math.max(1, requestedPage))
    : 1
  const query = params.get("q")?.trim().slice(0, 100) ?? ""
  const status = params.get("status")?.trim()
  const plan = params.get("plan")?.trim()
  const subscription = params.get("subscription")?.trim()
  const where: Prisma.BusinessWhereInput = {}
  if (status && status !== "all") where.status = status
  if (subscription === "unclaimed") {
    where.platformSubscription = { is: null }
  }
  if (plan && plan !== "all") {
    where.platformSubscription = {
      is: { planType: { equals: plan, mode: "insensitive" } },
    }
  }
  if (query) {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { branch: { contains: query, mode: "insensitive" } },
      { ownerName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ]
  }

  try {
    const [businesses, total, statusCounts, legacyLicenseCount, subscriptions] =
      await Promise.all([
        prisma.business.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            branch: true,
            ownerName: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
            _count: { select: { users: true, devices: true } },
            platformSubscription: {
              select: {
                planType: true,
                status: true,
                trialEndsAt: true,
                currentPeriodEndsAt: true,
                graceEndsAt: true,
              },
            },
            licenses: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                licenseType: true,
                status: true,
                expiryDate: true,
                deviceLimit: true,
              },
            },
            mpesaIntegrations: {
              select: {
                environment: true,
                accountType: true,
                shortcode: true,
                partyB: true,
              },
            },
          },
        }),
        prisma.business.count({ where }),
        prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.license.count(),
        prisma.platformSubscription.findMany({
          select: {
            status: true,
            trialEndsAt: true,
            currentPeriodEndsAt: true,
            graceEndsAt: true,
          },
        }),
      ])

    const subscriptionStatusCounts =
      subscriptions.reduce<Record<string, number>>((counts, subscription) => {
        const status = effectiveSubscriptionStatus(subscription)
        counts[status] = (counts[status] ?? 0) + 1
        return counts
      }, {})

    return NextResponse.json(
      {
        businesses: businesses.map((business) => ({
          ...business,
          subscription: business.platformSubscription
            ? {
                ...business.platformSubscription,
                status: effectiveSubscriptionStatus(
                  business.platformSubscription,
                ),
              }
            : null,
          platformSubscription: undefined,
          latestLicense: business.licenses[0] ?? null,
          licenses: undefined,
        })),
        total,
        page,
        pageSize,
        statusCounts: Object.fromEntries(
          statusCounts.map((entry) => [entry.status, entry._count._all]),
        ),
        subscriptionStatusCounts,
        legacyLicenseCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Platform tenant list failed:", error)
    return NextResponse.json({ error: "Unable to load platform businesses." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
