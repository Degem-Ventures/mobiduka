import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resolvedBusinessId = requireBusinessAccess(
      request,
      url.searchParams.get("businessId"),
    );

    if (!resolvedBusinessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const sessions = await prisma.cashSession.findMany({
      where: { businessId: resolvedBusinessId },
      include: {
        cashier: {
          select: {
            id: true,
            fullName: true,
            role: { select: { name: true } },
          },
        },
        shift: true,
      },
      orderBy: { openedAt: "asc" },
    });

    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const sales = await prisma.sale.aggregate({
          where: {
            businessId: resolvedBusinessId,
            cashierId: session.cashierId,
            createdAt: {
              gte: session.openedAt,
              ...(session.closedAt ? { lte: session.closedAt } : {}),
            },
          },
          _count: { id: true },
          _sum: { total: true },
        });

        return {
          id: session.id,
          cashierId: session.cashierId,
          cashier: session.cashier,
          shiftType: session.shiftType,
          shift: session.shift,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          sales: sales._count.id,
          amount: Number(sales._sum.total ?? 0),
          openingBalance: session.openingBalance,
          closingBalance: session.closingBalance,
          expectedBalance: session.expectedBalance,
          variance: session.variance,
        };
      }),
    );

    return NextResponse.json({ sessions: enrichedSessions });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load cash sessions.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      businessId,
      userId,
      openingCash,
      closingCash,
      sessionId,
      id,
      shiftTypeId,
    } = body as {
      action?: string;
      businessId?: string;
      userId?: string;
      openingCash?: number | string;
      closingCash?: number | string;
      sessionId?: string;
      id?: string;
      shiftTypeId?: string;
    };

    const resolvedBusinessId = requireBusinessAccess(request, businessId);

    if (!resolvedBusinessId || !userId || !action) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    if (action === "OPEN") {
      if (openingCash === undefined || openingCash === null) {
        return NextResponse.json(
          { error: "Opening cash amount is required to start a shift." },
          { status: 400 },
        );
      }

      const existingSession = await prisma.cashSession.findFirst({
        where: {
          businessId: resolvedBusinessId,
          cashierId: userId,
          closedAt: null,
        },
      });

      if (existingSession) {
        return NextResponse.json(
          {
            error: "Cannot open a new shift. An active session already exists for this operator.",
            sessionId: existingSession.id,
          },
          { status: 400 },
        );
      }

      const newSession = await prisma.cashSession.create({
        data: {
          id: id || undefined,
          businessId: resolvedBusinessId,
          cashierId: userId,
          shiftTypeId: shiftTypeId || undefined,
          ...(shiftTypeId
            ? {
                shiftType: (
                  await prisma.shiftType.findFirst({
                    where: { id: shiftTypeId, businessId: resolvedBusinessId, active: true },
                    select: { code: true },
                  })
                )?.code,
              }
            : {}),
          openingBalance: Number(openingCash),
          openedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId,
          action: "CASH_SESSION_OPEN",
          tableName: "CashSession",
          recordId: newSession.id,
          deviceId: null,
        },
      });

      return NextResponse.json(
        { success: true, sessionId: newSession.id, status: "OPEN" },
        { status: 201 },
      );
    }

    if (action === "CLOSE") {
      if (!sessionId || closingCash === undefined || closingCash === null) {
        return NextResponse.json(
          { error: "Session target ID and physical closing cash count are mandatory." },
          { status: 400 },
        );
      }

      const activeSession = await prisma.cashSession.findUnique({
        where: { id: sessionId },
      });

      if (!activeSession || activeSession.businessId !== resolvedBusinessId || activeSession.closedAt) {
        return NextResponse.json(
          { error: "Target session is invalid or already closed out." },
          { status: 404 },
        );
      }

      const sessionCashierId = activeSession.cashierId ?? userId;

      const sales = await prisma.sale.findMany({
        where: {
          businessId: resolvedBusinessId,
          cashierId: sessionCashierId,
          createdAt: { gte: activeSession.openedAt },
          payments: {
            some: {
              paymentMethod: {
                name: "CASH",
              },
            },
          },
        },
        select: { total: true },
      });

      const totalCashSales = sales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
      const cashExpenses = await prisma.expense.findMany({
        where: {
          businessId: resolvedBusinessId,
          recordedBy: sessionCashierId,
          createdAt: { gte: activeSession.openedAt },
        },
        select: { amount: true },
      });
      const totalCashExpenses = cashExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
      const expectedCashBalance = Number(activeSession.openingBalance) + totalCashSales - totalCashExpenses;
      const actualCashCount = Number(closingCash);
      const variance = actualCashCount - expectedCashBalance;

      const closedSession = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
          closingBalance: actualCashCount,
          expectedBalance: expectedCashBalance,
          variance,
          closedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId,
          action: "CASH_SESSION_CLOSE",
          tableName: "CashSession",
          recordId: closedSession.id,
          deviceId: null,
        },
      });

      await createSystemNotification({
        businessId: resolvedBusinessId,
        type: variance === 0 ? "success" : "warning",
        title: variance === 0 ? "Shift Closed" : "Cash Variance Detected",
        body: `Shift closed with counted cash of KSh ${actualCashCount.toLocaleString("en-KE")}. Variance: KSh ${variance.toLocaleString("en-KE")}.`,
        eventKey: `cash-session-closed:${closedSession.id}`,
      });

      return NextResponse.json(
        {
          success: true,
          summary: {
            sessionId: closedSession.id,
            openedAt: activeSession.openedAt,
            closedAt: closedSession.closedAt,
            openingCash: activeSession.openingBalance,
            totalCashSales,
            totalCashExpenses,
            expectedBalance: expectedCashBalance,
            actualCounted: actualCashCount,
            variance,
            hasVariance: variance !== 0,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: "Unsupported system action instruction parameter." },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to resolve cash shift adjustments.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
