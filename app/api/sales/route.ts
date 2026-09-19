import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

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
      select: { id: true },
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
      select: { id: true },
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

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountTotal = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
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
          subtotal: Number(totalAmount ?? subtotal),
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
    });

    return NextResponse.json(
      { success: true, saleId: completedSale.id, saleNumber: completedSale.saleNumber },
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
