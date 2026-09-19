import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

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

    await prisma.$transaction(async (tx) => {
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

      await tx.inventory.update({
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
