import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = requireBusinessAccess(request, searchParams.get("businessId"));

    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const [sales, expenses, cashSessions, products] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId, saleStatus: "COMPLETED", createdAt: { gte: yearStart, lt: nextDay } },
        include: { items: { include: { product: { select: { costPrice: true, category: { select: { name: true, reportGroup: true } } } } } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.findMany({ where: { businessId, createdAt: { gte: yearStart, lt: nextDay } }, select: { amount: true, createdAt: true } }),
      prisma.cashSession.findMany({
          where: { businessId, openedAt: { gte: yearStart, lt: nextDay } },
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

    const weekData = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return { date, day: date.toLocaleDateString("en-US", { weekday: "short" }), sales: 0, profit: 0, future: date > dayStart, isToday: date.getTime() === dayStart.getTime() };
    });
    const monthData = Array.from({ length: 12 }, (_, month) => ({ month: new Date(now.getFullYear(), month, 1).toLocaleDateString("en-US", { month: "short" }), sales: 0, profit: 0, future: month > now.getMonth(), isNow: month === now.getMonth() }));
    const categoryTotals = new Map<string, number>();
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let weekExpenses = 0;
    let todaySales = 0;
    let weekSales = 0;
    let weekProfit = 0;
    for (const expense of expenses) if (expense.createdAt >= weekStart) weekExpenses += expense.amount;
    for (const sale of sales) {
      let saleCost = 0;
      for (const item of sale.items) {
        saleCost += (item.product.costPrice ?? item.unitPrice * 0.6) * item.quantity;
        const category = item.product.category?.reportGroup ?? "Care & Wellness";
        categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + item.total);
      }
      totalRevenue += sale.total;
      totalCostOfGoods += saleCost;
      const saleDate = new Date(sale.createdAt);
      const weekIndex = Math.floor((saleDate.getTime() - weekStart.getTime()) / 86400000);
      if (weekIndex >= 0 && weekIndex < 7) { weekData[weekIndex].sales += sale.total; weekData[weekIndex].profit += sale.total - saleCost; weekSales += sale.total; weekProfit += sale.total - saleCost; }
      if (saleDate >= dayStart) todaySales += sale.total;
      const month = saleDate.getMonth();
      monthData[month].sales += sale.total;
      monthData[month].profit += sale.total - saleCost;
    }
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
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
        todaySales,
        weekSales,
        weekProfit,
        weekExpenses,
        avgMargin: weekSales > 0 ? (weekProfit / weekSales) * 100 : 0,
        currentMonth: monthData[now.getMonth()].month,
        year: now.getFullYear(),
        daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        currentDay: now.getDate(),
        bestMonth: monthData.filter(month => !month.future).sort((left, right) => right.sales - left.sales)[0]?.month ?? monthData[now.getMonth()].month,
      },
      trends: weekData.map(({ date, ...day }) => ({ date: date.toISOString().slice(0, 10), ...day })),
      monthly: monthData,
      categories: [...categoryTotals.entries()].map(([name, revenue]) => ({ name, revenue, value: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0 })),
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