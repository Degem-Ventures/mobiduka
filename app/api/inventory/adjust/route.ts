import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, userId, productId, adjustmentQuantity, reason } = body as {
      businessId?: string;
      userId?: string;
      productId?: string;
      adjustmentQuantity?: number | string;
      reason?: string;
    };
    const resolvedBusinessId = requireBusinessAccess(request, businessId);

    if (!resolvedBusinessId || !userId || !productId || adjustmentQuantity === undefined) {
      return NextResponse.json(
        { error: "Authenticated business context and inventory parameters are required." },
        { status: 401 },
      );
    }

    const quantityDelta = Number(adjustmentQuantity);

    const adjustment = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, businessId: resolvedBusinessId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!product) throw new Error("Product does not belong to this business.");

      const inventory = await tx.inventory.upsert({
        where: { productId },
        create: {
          businessId: resolvedBusinessId,
          productId,
          quantity: 0,
          reservedQuantity: 0,
        },
        update: {},
      });

      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: {
            increment: quantityDelta,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId,
          action: "STOCK_ADJUSTMENT",
          tableName: "Inventory",
          recordId: productId,
          deviceId: null,
          timestamp: new Date(),
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          userId,
          movementType: quantityDelta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          quantity: Math.abs(quantityDelta),
          reference: `ADJUST-${Date.now()}`,
          notes: reason ?? "Inventory adjustment",
        },
      });

      return { product, quantity: updatedInventory.quantity };
    });

    await createSystemNotification({
      businessId: resolvedBusinessId,
      type: quantityDelta >= 0 ? "info" : "warning",
      title: quantityDelta >= 0 ? "Inventory Added" : "Inventory Reduced",
      body: `${adjustment.product.name} inventory changed by ${quantityDelta >= 0 ? "+" : ""}${quantityDelta} units. Current stock: ${adjustment.quantity} units.`,
      eventKey: `inventory-adjustment:${productId}:${Date.now()}`,
      preference: quantityDelta < 0 ? "lowStockAlerts" : undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Inventory layout metrics synchronized cleanly.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to update item tracking records.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
