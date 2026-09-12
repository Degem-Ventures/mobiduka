import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Tenant context filter key missing from parameter list." },
        { status: 400 },
      );
    }

    const products = await prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
      },
      include: {
        inventory: true,
      },
    });

    const lowStockItems = products.filter((product) => {
      const minimumStock = Number(product.minimumStock ?? 0);
      const stock = Number(product.inventory?.quantity ?? 0);
      return stock < minimumStock;
    });

    return NextResponse.json({
      success: true,
      alertCount: lowStockItems.length,
      alerts: lowStockItems.map((item) => ({
        type: "LOW_STOCK",
        title: "Low Stock Warning Alert",
        message: `${item.name} (${item.sku ?? "N/A"}) is running low. Current stock is ${item.inventory?.quantity ?? 0} items remaining.`,
        meta: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          stock: item.inventory?.quantity ?? 0,
          minimumStock: item.minimumStock,
        },
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch active alert flags.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
