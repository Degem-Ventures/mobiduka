import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    if (!businessId || !userId || !productId || adjustmentQuantity === undefined) {
      return NextResponse.json(
        { error: "Bad parameters. Missing metrics for verification logs." },
        { status: 400 },
      );
    }

    const quantityDelta = Number(adjustmentQuantity);

    await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.upsert({
        where: { productId },
        create: {
          businessId,
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
          businessId,
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
