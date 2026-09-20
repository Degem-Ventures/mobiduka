import { NextRequest, NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requestedBusinessId } from "@/lib/auth";

const DAYS = 30;

function dateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function money(value: number) {
  return Number(value.toFixed(2));
}

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const businessId = requestedBusinessId(request, params.get("businessId"));
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, branch: true, country: true, currency: true, timezone: true },
    });
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const timeZone = business.timezone || "Africa/Nairobi";
    const today = dateKey(new Date(), timeZone);
    const periodStart = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

    const [sales, expenses, products, customers, cashSessions, scans] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId, createdAt: { gte: periodStart }, saleStatus: "COMPLETED" },
        include: {
          customer: { select: { name: true } },
          items: { select: { quantity: true, total: true, product: { select: { id: true, name: true, costPrice: true } } } },
          payments: { select: { amount: true, paymentMethod: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { businessId, createdAt: { gte: periodStart } },
        select: { amount: true, createdAt: true, recordedBy: true },
      }),
      prisma.product.findMany({
        where: { businessId, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, barcode: true, costPrice: true, minimumStock: true, inventory: { select: { quantity: true } } },
      }),
      prisma.customer.findMany({
        where: { businessId, status: "ACTIVE" },
        select: { id: true, name: true, creditAccount: { select: { balance: true } } },
      }),
      prisma.cashSession.findMany({
        where: { businessId, closedAt: null },
        select: { id: true, cashierId: true, openingBalance: true, openedAt: true },
      }),
      prisma.scanEvent.findMany({
        where: { businessId, createdAt: { gte: periodStart } },
        select: { id: true, barcode: true, name: true, status: true, emoji: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const todaySales = sales.filter((sale) => dateKey(sale.createdAt, timeZone) === today);
    const todayExpenses = expenses.filter((expense) => dateKey(expense.createdAt, timeZone) === today);
    const periodRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const costOfGoods = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.product.costPrice ?? item.total * 0.6) * item.quantity, 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const todayCostOfGoods = todaySales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.product.costPrice ?? item.total * 0.6) * item.quantity, 0), 0);
    const todayExpenseTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const todayProfit = todayRevenue - todayCostOfGoods - todayExpenseTotal;
    const periodProfit = periodRevenue - costOfGoods - totalExpenses;

    const paymentBreakdown = new Map<string, { amount: number; transactions: number }>();
    for (const sale of todaySales) {
      for (const payment of sale.payments) {
        const name = payment.paymentMethod.name.toUpperCase();
        const current = paymentBreakdown.get(name) ?? { amount: 0, transactions: 0 };
        current.amount += payment.amount;
        current.transactions += 1;
        paymentBreakdown.set(name, current);
      }
    }

    const productTotals = new Map<string, { name: string; units: number; revenue: number }>();
    for (const sale of todaySales) {
      for (const item of sale.items) {
        const current = productTotals.get(item.product.id) ?? { name: item.product.name, units: 0, revenue: 0 };
        current.units += item.quantity;
        current.revenue += item.total;
        productTotals.set(item.product.id, current);
      }
    }

    const lowStockItems = products
      .filter((product) => product.minimumStock !== null && (product.inventory?.quantity ?? 0) <= product.minimumStock)
      .map((product) => ({ id: product.id, name: product.name, barcode: product.barcode, quantity: product.inventory?.quantity ?? 0, minimumStock: product.minimumStock }));
    const creditBalance = customers.reduce((sum, customer) => sum + (customer.creditAccount?.balance ?? 0), 0);
    const cashPayments = paymentBreakdown.get("CASH")?.amount ?? 0;
    const cashExpenses = todayExpenses.filter((expense) => !expense.recordedBy || cashSessions.some((session) => session.cashierId === expense.recordedBy)).reduce((sum, expense) => sum + expense.amount, 0);
    const currentTill = cashSessions.reduce((sum, session) => sum + session.openingBalance, 0) + cashPayments - cashExpenses;
    const scanCounts = scans.reduce((counts, scan) => {
      counts[scan.status] = (counts[scan.status] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      metadata: { businessId: business.id, name: business.name, branch: business.branch, country: business.country, currency: business.currency, timezone: timeZone, date: today },
      summary: {
        todayRevenue: money(todayRevenue),
        todayProfit: money(todayProfit),
        todayExpenseTotal: money(todayExpenseTotal),
        todayTransactionCount: todaySales.length,
        periodRevenue: money(periodRevenue),
        periodProfit: money(periodProfit),
        profitMarginPercentage: todayRevenue ? money((todayProfit / todayRevenue) * 100) : 0,
        periodProfitMarginPercentage: periodRevenue ? money((periodProfit / periodRevenue) * 100) : 0,
        cashInTill: money(currentTill),
        creditOut: money(creditBalance),
        creditCustomerCount: customers.filter((customer) => (customer.creditAccount?.balance ?? 0) > 0).length,
        inventoryValue: money(products.reduce((sum, product) => sum + (product.inventory?.quantity ?? 0) * (product.costPrice ?? 0), 0)),
        activeSkuCount: products.length,
        lowStockCount: lowStockItems.length,
      },
      paymentBreakdown: Object.fromEntries([...paymentBreakdown].map(([method, value]) => [method, { amount: money(value.amount), transactions: value.transactions }])),
      topProducts: [...productTotals.values()].sort((a, b) => b.units - a.units).slice(0, 5).map((product) => ({ ...product, revenue: money(product.revenue) })),
      recentTransactions: sales.slice(0, 10).map((sale) => ({ id: sale.id, time: sale.createdAt, customer: sale.customer?.name ?? "Walk-in", amount: money(sale.total), items: sale.items.reduce((sum, item) => sum + item.quantity, 0), method: sale.payments[0]?.paymentMethod.name ?? "Unknown" })),
      lowStockItems,
      cashSessions,
      scanActivity: { counts: scanCounts, recent: scans },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to assemble dashboard data.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
