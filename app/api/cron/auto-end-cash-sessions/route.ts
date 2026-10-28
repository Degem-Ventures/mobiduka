import { NextRequest, NextResponse } from "next/server.js"
import { getCashSessionAutoEndAt } from "@/lib/cash-session-auto-end"
import { createSystemNotification } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function isAuthorizedCronRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true
  const configuredSecret = process.env.CRON_SECRET
  return Boolean(
    configuredSecret &&
      request.headers.get("authorization") === `Bearer ${configuredSecret}`,
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, {
      status: 401,
    })
  }

  try {
    const activeSessions = await prisma.cashSession.findMany({
      where: { closedAt: null },
      select: {
        id: true,
        businessId: true,
        cashierId: true,
        openingBalance: true,
        openedAt: true,
        shift: { select: { scheduledStart: true, scheduledEnd: true } },
        business: { select: { name: true, timezone: true } },
        cashier: { select: { fullName: true } },
      },
    })
    const result = { autoEnded: 0, skipped: 0, failed: 0 }

    for (const session of activeSessions) {
      try {
        const deadline = getCashSessionAutoEndAt({
          openedAt: session.openedAt,
          scheduledStart: session.shift?.scheduledStart ?? null,
          scheduledEnd: session.shift?.scheduledEnd ?? null,
          timeZone: session.business.timezone,
        })
        const closedAt = new Date()
        if (deadline > closedAt) {
          result.skipped++
          continue
        }

        const autoEndResult = await prisma.$transaction(async (transaction) => {
          const cashSales = await transaction.sale.findMany({
            where: {
              businessId: session.businessId,
              createdAt: { gte: session.openedAt, lte: closedAt },
              payments: {
                some: { paymentMethod: { name: "CASH" } },
              },
              OR: [
                { cashSessionId: session.id },
                ...(session.cashierId
                  ? [
                      {
                        cashSessionId: null,
                        cashierId: session.cashierId,
                      },
                    ]
                  : []),
              ],
            },
            select: { total: true },
          })
          const cashExpenses = session.cashierId
            ? await transaction.expense.findMany({
                where: {
                  businessId: session.businessId,
                  recordedBy: session.cashierId,
                  createdAt: { gte: session.openedAt, lte: closedAt },
                },
                select: { amount: true },
              })
            : []
          const totalCashSales = cashSales.reduce(
            (total, sale) => total + Number(sale.total ?? 0),
            0,
          )
          const totalCashExpenses = cashExpenses.reduce(
            (total, expense) => total + Number(expense.amount ?? 0),
            0,
          )
          const expectedBalance =
            Number(session.openingBalance) + totalCashSales - totalCashExpenses
          const updated = await transaction.cashSession.updateMany({
            where: { id: session.id, closedAt: null },
            data: {
              closedAt,
              autoEndedAt: closedAt,
              closingBalance: null,
              expectedBalance,
              variance: null,
            },
          })

          if (updated.count !== 1) return null

          await transaction.device.updateMany({
            where: { currentCashSessionId: session.id },
            data: { currentCashSessionId: null },
          })
          await transaction.auditLog.create({
            data: {
              businessId: session.businessId,
              userId: null,
              action: "CASH_SESSION_AUTO_CLOSE",
              tableName: "CashSession",
              recordId: session.id,
              deviceId: null,
            },
          })

          return { expectedBalance }
        })

        if (!autoEndResult) {
          result.skipped++
          continue
        }

        await createSystemNotification({
          businessId: session.businessId,
          type: "warning",
          title: "Shift Auto-Ended",
          body: `The shift for ${session.cashier?.fullName ?? "the cashier"} at ${session.business.name} was automatically ended after its allowed duration. Expected cash is KSh ${autoEndResult.expectedBalance.toLocaleString("en-KE")}; no physical closing cash count was recorded.`,
          eventKey: `cash-session-auto-ended:${session.id}`,
        })
        result.autoEnded++
      } catch (error) {
        result.failed++
        console.error(
          `Automatic shift end failed for cash session ${session.id}.`,
          error,
        )
      }
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Automatic cash session end cron failed.", error)
    return NextResponse.json(
      { error: "Open shifts could not be processed." },
      { status: 500 },
    )
  }
}
