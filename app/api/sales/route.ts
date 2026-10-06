import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

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

    const limitValue = Number(searchParams.get("limit") ?? 10);
    const limit = Number.isInteger(limitValue)
      ? Math.min(Math.max(limitValue, 1), 20)
      : 10;
    const cursor = searchParams.get("cursor");
    if (cursor) {
      const cursorSale = await prisma.sale.findFirst({
        where: { id: cursor, businessId, saleStatus: "COMPLETED" },
        select: { id: true },
      });
      if (!cursorSale) {
        return NextResponse.json(
          { error: "Receipt history cursor is invalid." },
          { status: 400 },
        );
      }
    }

    const [business, sales] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, branch: true },
      }),
      prisma.sale.findMany({
        where: { businessId, saleStatus: "COMPLETED" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          saleNumber: true,
          createdAt: true,
          subtotal: true,
          discount: true,
          total: true,
          cashier: { select: { fullName: true } },
          customer: { select: { name: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              total: true,
              product: { select: { name: true, emoji: true } },
            },
          },
          payments: {
            orderBy: { receivedAt: "asc" },
            select: { paymentMethod: { select: { name: true } } },
          },
        },
      }),
    ]);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const hasNextPage = sales.length > limit;
    if (hasNextPage) sales.pop();
    return NextResponse.json({
      success: true,
      business,
      nextCursor: hasNextPage ? sales.at(-1)?.id ?? null : null,
      receipts: sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber ?? sale.id,
        createdAt: sale.createdAt,
        businessName: business.name,
        businessBranch: business.branch,
        subtotal: sale.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ),
        discountAmount: sale.discount,
        total: sale.total,
        cashier: sale.cashier?.fullName ?? "Unknown cashier",
        customer: sale.customer?.name ?? null,
        paymentMethod: sale.payments[0]?.paymentMethod.name ?? "CASH",
        items: sale.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          price: item.unitPrice,
          quantity: item.quantity,
          total: item.total,
          emoji: item.product.emoji ?? "📦",
        })),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch receipt history.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      cashierId,
      userId,
      customerId,
      invoiceNo,
      totalAmount,
      subtotal: requestedSubtotal,
      discountAmount: requestedDiscount,
      paymentMode,
      mpesaRef,
      items,
    } = body as {
      businessId?: string;
      cashierId?: string;
      userId?: string;
      customerId?: string | null;
      invoiceNo?: string;
      totalAmount?: number | string;
      subtotal?: number | string;
      discountAmount?: number | string;
      paymentMode?: string;
      mpesaRef?: string | null;
      items?: Array<{
        productId: string;
        quantity: number | string;
        unitPrice?: number | string;
        price?: number | string;
        discount?: number | string;
        tax?: number | string;
        total?: number | string;
      }>;
    };

    const resolvedCashierId = cashierId ?? userId;
    const resolvedBusinessId = requireBusinessAccess(request, businessId);

    if (!resolvedBusinessId || !resolvedCashierId || !invoiceNo || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: resolvedBusinessId },
      select: { id: true, name: true, branch: true, country: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Invalid businessId. The target store was not found." },
        { status: 400 },
      );
    }

    const cashier = await prisma.user.findFirst({
      where: {
        id: resolvedCashierId,
        businessId: resolvedBusinessId,
      },
      select: { id: true, fullName: true },
    });

    if (!cashier) {
      return NextResponse.json(
        { error: "The cashier user does not belong to this business." },
        { status: 400 },
      );
    }

    const existingSale = await prisma.sale.findUnique({
      where: { saleNumber: String(invoiceNo).trim() },
      select: { id: true, businessId: true },
    });
    if (existingSale) {
      return NextResponse.json(
        {
          error: "An invoice with this invoice number already exists.",
          saleId: existingSale.id,
          sameBusiness: existingSale.businessId === resolvedBusinessId,
        },
        { status: 409 },
      );
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      discount: Number(item.discount ?? 0),
      tax: Number(item.tax ?? 0),
      total: Number(item.total ?? Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? 0)),
    }));

    const itemSubtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const subtotal = Number(requestedSubtotal ?? itemSubtotal);
    const discountTotal = Number(
      requestedDiscount ??
        normalizedItems.reduce((sum, item) => sum + item.discount, 0),
    );
    const taxTotal = normalizedItems.reduce((sum, item) => sum + item.tax, 0);
    const computedTotal = subtotal - discountTotal + taxTotal;
    const normalizedPaymentMode = String(paymentMode ?? "CASH").trim().toUpperCase();
    const saleTotal = Number(totalAmount ?? computedTotal);

    const completedSale = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          businessId: resolvedBusinessId,
          cashierId: resolvedCashierId,
          customerId: customerId ?? null,
          saleNumber: String(invoiceNo).trim(),
          subtotal,
          discount: discountTotal,
          tax: taxTotal,
          total: saleTotal,
          paymentStatus: normalizedPaymentMode ? "PAID" : "PENDING",
          saleStatus: "COMPLETED",
        },
      });

      for (const item of normalizedItems) {
        if (!item.productId) {
          throw new Error("Every sale item requires a productId.");
        }

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
            total: item.total,
          },
        });

        const inventory = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });

        if (!inventory) {
          await tx.inventory.create({
            data: {
              businessId: resolvedBusinessId,
              productId: item.productId,
              quantity: 0,
              reservedQuantity: 0,
            },
          });
        }

        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });
      }

      const paymentMethodName = normalizedPaymentMode || "CASH";
      const paymentMethod = await tx.paymentMethod.upsert({
        where: { name: paymentMethodName },
        update: {},
        create: { name: paymentMethodName },
      });

      await tx.payment.create({
        data: {
          saleId: sale.id,
          paymentMethodId: paymentMethod.id,
          amount: saleTotal,
          reference: paymentMethodName === "MPESA" ? mpesaRef ?? null : null,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId: resolvedCashierId,
          action: "SALE_CREATED",
          tableName: "Sale",
          recordId: sale.id,
          deviceId: null,
        },
      });

      return sale;
    }, { maxWait: 10_000, timeout: 30_000 });

    await createSystemNotification({
      businessId: resolvedBusinessId,
      type: "success",
      title: "Sale Completed",
      body: `Sale ${completedSale.saleNumber} was completed for KSh ${saleTotal.toLocaleString("en-KE")}.`,
      eventKey: `sale:${completedSale.id}`,
      preference: "salesNotifications",
    });

    const soldProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const soldProducts = await prisma.product.findMany({
      where: { id: { in: soldProductIds }, businessId: resolvedBusinessId },
      select: { id: true, name: true, minimumStock: true, inventory: { select: { quantity: true } } },
    });
    await Promise.all(soldProducts.flatMap((product) => {
      const quantity = product.inventory?.quantity ?? 0;
      if (product.minimumStock === null || quantity > product.minimumStock) return [];
      return [createSystemNotification({
        businessId: resolvedBusinessId,
        type: "critical",
        title: "Critical Stock Alert",
        body: `${product.name} has only ${quantity} units remaining. Reorder level is ${product.minimumStock} units.`,
        eventKey: `low-stock:${product.id}:critical`,
        preference: "lowStockAlerts",
      })];
    }));

    const dayStart = new Date(completedSale.createdAt);
    dayStart.setHours(0, 0, 0, 0);
    const dailySales = await prisma.sale.aggregate({
      where: { businessId: resolvedBusinessId, createdAt: { gte: dayStart }, saleStatus: "COMPLETED" },
      _sum: { total: true },
    });
    const dailyTarget = Number(process.env.DAILY_SALES_TARGET_KES ?? "70000");
    const dailyTotal = Number(dailySales._sum.total ?? 0);
    if (Number.isFinite(dailyTarget) && dailyTotal >= dailyTarget) {
      await createSystemNotification({
        businessId: resolvedBusinessId,
        type: "success",
        title: "Daily Sales Target Achieved",
        body: `Today's sales of KSh ${dailyTotal.toLocaleString("en-KE")} exceeded the daily target of KSh ${dailyTarget.toLocaleString("en-KE")}.`,
        eventKey: `daily-sales-target:${dayStart.toISOString().slice(0, 10)}`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        saleId: completedSale.id,
        saleNumber: completedSale.saleNumber,
        createdAt: completedSale.createdAt,
        cashier: { id: cashier.id, name: cashier.fullName },
        business: { name: business.name, branch: business.branch, country: business.country },
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Processing sales record layout failed.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
