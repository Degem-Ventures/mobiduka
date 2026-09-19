import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });

    const orders = await prisma.purchaseOrder.findMany({
      where: { businessId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error);
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, businessId, supplierId, orderNo, totalCost, dueDate, items, orderId } = body;
    const resolvedBusinessId = requireBusinessAccess(request, businessId);
    const requestedOrderId = typeof orderId === "string" && orderId.trim() && orderId.trim().toLowerCase() !== "string"
      ? orderId.trim()
      : undefined;

    if (!resolvedBusinessId || !action) {
      return NextResponse.json(
        { error: "Authenticated business context and action are required." },
        { status: 401 },
      );
    }

    if (action === "CREATE") {
      if (!supplierId || !orderNo || !items || !Array.isArray(items)) {
        return NextResponse.json(
          { error: "Missing purchase request fields." },
          { status: 400 },
        );
      }

      const supplierExists = await prisma.supplier.findFirst({
        where: {
          id: supplierId,
          businessId: resolvedBusinessId,
        },
        select: { id: true },
      });

      if (!supplierExists) {
        return NextResponse.json(
          { error: "Supplier does not belong to this business or could not be found." },
          { status: 400 },
        );
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.create({
          data: {
            id: requestedOrderId,
            businessId: resolvedBusinessId,
            supplierId,
            orderNo,
            status: "REQUESTED",
            totalCost: Number(totalCost ?? 0),
            dueDate: dueDate ? new Date(dueDate) : null,
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
      if (!requestedOrderId) {
        return NextResponse.json(
          { error: "Target purchase order ID is mandatory." },
          { status: 400 },
        );
      }

      const existingOrder = await prisma.purchaseOrder.findUnique({
        where: { id: requestedOrderId },
        include: { items: true },
      });

      if (!existingOrder || existingOrder.businessId !== resolvedBusinessId || existingOrder.status === "RECEIVED") {
        return NextResponse.json(
          { error: "Purchase record is invalid or already finalized." },
          { status: 404 },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: requestedOrderId },
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
              businessId: resolvedBusinessId,
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
