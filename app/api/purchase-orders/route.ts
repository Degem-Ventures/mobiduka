import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, businessId, supplierId, orderNo, totalCost, items, orderId } = body;

    if (!businessId || !action) {
      return NextResponse.json(
        { error: "Missing required core configuration parameters." },
        { status: 400 },
      );
    }

    if (action === "CREATE") {
      if (!supplierId || !orderNo || !items || !Array.isArray(items)) {
        return NextResponse.json(
          { error: "Missing purchase request fields." },
          { status: 400 },
        );
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.create({
          data: {
            id: orderId || undefined,
            businessId,
            supplierId,
            orderNo,
            status: "REQUESTED",
            totalCost: Number(totalCost ?? 0),
          },
        });

        for (const item of items) {
          await tx.purchaseItem.create({
            data: {
              purchaseOrderId: order.id,
              productId: item.productId,
              quantity: Number(item.quantity ?? 0),
              costPrice: Number(item.costPrice ?? 0),
            },
          });
        }

        return order;
      });

      return NextResponse.json(
        { success: true, orderId: newOrder.id, status: "REQUESTED" },
        { status: 201 },
      );
    }

    if (action === "RECEIVE") {
      if (!orderId) {
        return NextResponse.json(
          { error: "Target purchase order ID is mandatory." },
          { status: 400 },
        );
      }

      const existingOrder = await prisma.purchaseOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!existingOrder || existingOrder.status === "RECEIVED") {
        return NextResponse.json(
          { error: "Purchase record is invalid or already finalized." },
          { status: 404 },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: "RECEIVED" },
        });

        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              costPrice: item.costPrice,
            },
          });

          await tx.inventory.upsert({
            where: { productId: item.productId },
            update: {
              quantity: { increment: item.quantity },
            },
            create: {
              businessId,
              productId: item.productId,
              quantity: item.quantity,
              reservedQuantity: 0,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: "Inventory metrics incremented upon successful batch delivery.",
      });
    }

    return NextResponse.json(
      { error: "Unsupported transaction action rule instruction." },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to compile supply ledger details.", details: error.message },
      { status: 500 },
    );
  }
}
