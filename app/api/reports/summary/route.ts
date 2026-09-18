import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

const ALLOWED_DAY_RANGES = new Set([7, 30, 90]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = requireBusinessAccess(request, searchParams.get("businessId"));
    const parsedDays = Number.parseInt(searchParams.get("days") ?? "7", 10);
    const totalDays = ALLOWED_DAY_RANGES.has(parsedDays) ? parsedDays : 7;

    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (totalDays - 1));

    const [sales, expensesSummary, cashSessions, products] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId, createdAt: { gte: startDate } },
        include: { items: { include: { product: { select: { costPrice: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { businessId, createdAt: { gte: startDate } },
      }),
      prisma.cashSession.findMany({
        where: { businessId, openedAt: { gte: startDate } },
        select: { openingBalance: true, closingBalance: true, closedAt: true },
      }),
      prisma.product.findMany({
        where: { businessId, status: "ACTIVE", deletedAt: null },
        select: {
          costPrice: true,
          minimumStock: true,
          inventory: { select: { quantity: true } },
        },
      }),
    ]);

    const dailyMap: Record<string, { date: string; revenue: number; cost: number; profit: number }> = {};
    for (let index = 0; index < totalDays; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      dailyMap[dateKey] = { date: dateKey, revenue: 0, cost: 0, profit: 0 };
    }

    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    for (const sale of sales) {
      let saleCost = 0;
      for (const item of sale.items) {
        saleCost += (item.product.costPrice ?? item.unitPrice * 0.6) * item.quantity;
      }

      totalRevenue += sale.total;
      totalCostOfGoods += saleCost;
      const dateKey = sale.createdAt.toISOString().slice(0, 10);
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].revenue += sale.total;
        dailyMap[dateKey].cost += saleCost;
        dailyMap[dateKey].profit += sale.total - saleCost;
      }
    }

    const totalExpenses = expensesSummary._sum.amount ?? 0;
    const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;
    const lowStockAlertsCount = products.filter(
      (product) => product.minimumStock !== null && (product.inventory?.quantity ?? 0) <= product.minimumStock,
    ).length;
    const inventoryValuation = products.reduce(
      (total, product) => total + (product.inventory?.quantity ?? 0) * (product.costPrice ?? 0),
      0,
    );
    const inventoryUnits = products.reduce(
      (total, product) => total + (product.inventory?.quantity ?? 0),
      0,
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        totalCostOfGoods,
        totalExpenses,
        netProfit,
        profitMarginPercentage: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0",
        lowStockAlertsCount,
        inventoryValuation,
        inventoryUnits,
        activeOpenShiftsCount: cashSessions.filter((session) => session.closedAt === null).length,
        openingCashTotal: cashSessions.reduce((sum, session) => sum + session.openingBalance, 0),
      },
      trends: Object.values(dailyMap),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to assemble analytical data reporting matrices.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}