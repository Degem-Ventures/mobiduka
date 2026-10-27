import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"
import { effectiveSubscriptionStatus } from "@/lib/subscriptions"

type OverviewDailyCount = {
  day: string
  count: number
}

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    })
  }

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [
      businessCount,
      userCount,
      activeDeviceCount,
      sales,
      saleCount,
      subscriptions,
      recentMpesaTransactions,
      salesTrendRows,
      businessTrendRows,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.user.count(),
      prisma.device.count({ where: { status: "ACTIVE" } }),
      prisma.sale.aggregate({
        where: {
          saleStatus: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { total: true },
      }),
      prisma.sale.count({
        where: {
          saleStatus: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.platformSubscription.findMany({
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEndsAt: true,
          graceEndsAt: true,
        },
      }),
      prisma.mpesaTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          checkoutRequestId: true,
          amount: true,
          status: true,
          createdAt: true,
          business: { select: { name: true, branch: true, currency: true } },
        },
      }),
      prisma.$queryRaw<Array<OverviewDailyCount>>`
        SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "Sale"
        WHERE "saleStatus" = 'COMPLETED' AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<Array<OverviewDailyCount>>`
        SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "Business"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1
      `,
    ])

    const salesByDay = new Map(
      salesTrendRows.map((row) => [row.day, row.count]),
    )
    const businessesByDay = new Map(
      businessTrendRows.map((row) => [row.day, row.count]),
    )
    const trend = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(now)
      day.setUTCHours(0, 0, 0, 0)
      day.setUTCDate(day.getUTCDate() - (29 - index))
      const key = day.toISOString().slice(0, 10)
      return {
        day: new Intl.DateTimeFormat("en-KE", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(day),
        completedSales: salesByDay.get(key) ?? 0,
        businessesCreated: businessesByDay.get(key) ?? 0,
      }
    })

    const subscriptionStatuses = subscriptions.reduce<Record<string, number>>(
      (counts, subscription) => {
        const status = effectiveSubscriptionStatus(subscription)
        counts[status] = (counts[status] ?? 0) + 1
        return counts
      },
      {},
    )

    return NextResponse.json(
      {
        metrics: {
          businesses: businessCount,
          users: userCount,
          activeDevices: activeDeviceCount,
          completedSales30d: saleCount,
          salesVolume30d: sales._sum.total ?? 0,
          activeSubscriptions: subscriptionStatuses.ACTIVE ?? 0,
          trialSubscriptions: subscriptionStatuses.TRIAL ?? 0,
          attentionSubscriptions:
            (subscriptionStatuses.GRACE ?? 0) +
            (subscriptionStatuses.EXPIRED ?? 0) +
            (subscriptionStatuses.REVOKED ?? 0),
        },
        recentMpesaTransactions: recentMpesaTransactions.map((transaction) => ({
          ...transaction,
          businessName: transaction.business.branch
            ? `${transaction.business.name} · ${transaction.business.branch}`
            : transaction.business.name,
          currency: transaction.business.currency,
        })),
        trend,
        generatedAt: now,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Platform overview load failed:", error)
    return NextResponse.json({ error: "Unable to load platform overview." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
