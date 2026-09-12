import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    } = body as {
      action?: string;
      businessId?: string;
      userId?: string;
      openingCash?: number | string;
      closingCash?: number | string;
      sessionId?: string;
      id?: string;
    };

    if (!businessId || !userId || !action) {
      return NextResponse.json(
        { error: "Missing required multi-tenant parameters." },
        { status: 400 },
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
          businessId,
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
          businessId,
          cashierId: userId,
          openingBalance: Number(openingCash),
          openedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
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

      if (!activeSession || activeSession.closedAt) {
        return NextResponse.json(
          { error: "Target session is invalid or already closed out." },
          { status: 404 },
        );
      }

      const sales = await prisma.sale.findMany({
        where: {
          businessId,
          cashierId: userId,
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
      const expectedCashBalance = Number(activeSession.openingBalance) + totalCashSales;
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
          businessId,
          userId,
          action: "CASH_SESSION_CLOSE",
          tableName: "CashSession",
          recordId: closedSession.id,
          deviceId: null,
        },
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
