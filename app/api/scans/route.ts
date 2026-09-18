import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestedBusinessId } from "@/lib/auth";

const ALLOWED_OVERRIDES = new Set(["AUTO", "MANUAL"]);

type ScanProduct = {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number | null;
  costPrice: number | null;
  minimumStock: number | null;
  supplier: { id: string; name: string } | null;
  category: { name: string } | null;
  inventory: { quantity: number; reservedQuantity: number } | null;
};

async function findProduct(businessId: string, barcode: string): Promise<ScanProduct | null> {
  return prisma.product.findFirst({
    where: { businessId, barcode, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      name: true,
      barcode: true,
      sellingPrice: true,
      costPrice: true,
      minimumStock: true,
      supplier: { select: { id: true, name: true } },
      category: { select: { name: true } },
      inventory: { select: { quantity: true, reservedQuantity: true } },
    },
  });
}

function productResponse(product: ScanProduct) {
  const quantity = product.inventory?.quantity ?? 0;
  const minimumStock = product.minimumStock ?? 0;
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    category: product.category?.name ?? null,
    supplier: product.supplier,
    price: product.sellingPrice ?? 0,
    costPrice: product.costPrice ?? 0,
    stock: quantity,
    reservedStock: product.inventory?.reservedQuantity ?? 0,
    minimumStock: product.minimumStock,
    stockStatus: quantity <= minimumStock ? "LOW" : "GOOD",
    cartItem: {
      productId: product.id,
      name: product.name,
      unitPrice: product.sellingPrice ?? 0,
      quantity: 1,
    },
  };
}

async function registerScan(
  businessId: string,
  barcode: string,
  statusOverride: string,
  product: ScanProduct | null,
) {
  const status = statusOverride === "MANUAL" ? "MANUAL" : product ? "FOUND" : "UNKNOWN";
  return prisma.scanEvent.create({
    data: {
      businessId,
      productId: product?.id,
      barcode,
      name: product?.name ?? "Unknown Product",
      status,
      emoji: status === "MANUAL" ? "📝" : status === "FOUND" ? "📦" : "❓",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const barcode = String(params.get("barcode") ?? "").trim();
    const businessId = requestedBusinessId(request, params.get("businessId"));
    if (!businessId || !barcode) {
      return NextResponse.json({ error: "Authenticated business and barcode are required." }, { status: 400 });
    }

    const product = await findProduct(businessId, barcode);
    await registerScan(businessId, barcode, "AUTO", product);
    return NextResponse.json({
      success: true,
      found: Boolean(product),
      product: product ? productResponse(product) : null,
      status: product ? "FOUND" : "UNKNOWN",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to look up scanned product.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      barcode?: unknown;
      businessId?: unknown;
      statusOverride?: unknown;
      action?: unknown;
      userId?: unknown;
      quantity?: unknown;
      reason?: unknown;
    };
    const barcode = String(body.barcode ?? "").trim();
    const businessId = requestedBusinessId(request, body.businessId);
    const statusOverride = String(body.statusOverride ?? "AUTO").trim().toUpperCase();
    const action = String(body.action ?? "LOOKUP").trim().toUpperCase();

    if (!businessId || !barcode) {
      return NextResponse.json({ error: "Authenticated business and barcode are required." }, { status: 400 });
    }
    if (!ALLOWED_OVERRIDES.has(statusOverride)) {
      return NextResponse.json({ error: "statusOverride must be AUTO or MANUAL." }, { status: 400 });
    }
    if (!["LOOKUP", "ADD_TO_CART", "RESTOCK"].includes(action)) {
      return NextResponse.json({ error: "action must be LOOKUP, ADD_TO_CART, or RESTOCK." }, { status: 400 });
    }

    const matchedProduct = await findProduct(businessId, barcode);
    const scanEvent = await registerScan(businessId, barcode, statusOverride, matchedProduct);

    if (!matchedProduct) {
      if (action === "RESTOCK") {
        return NextResponse.json({ error: "Cannot restock an unknown barcode.", scanId: scanEvent.id }, { status: 404 });
      }
      return NextResponse.json({ success: true, found: false, status: "UNKNOWN", scanId: scanEvent.id, product: null });
    }

    if (action === "RESTOCK") {
      const quantity = Number(body.quantity);
      const userId = String(body.userId ?? "").trim();
      if (!Number.isInteger(quantity) || quantity <= 0 || !userId) {
        return NextResponse.json({ error: "RESTOCK requires a positive integer quantity and userId." }, { status: 400 });
      }
      const user = await prisma.user.findFirst({ where: { id: userId, businessId }, select: { id: true } });
      if (!user) return NextResponse.json({ error: "User does not belong to this business." }, { status: 403 });

      const result = await prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.upsert({
          where: { productId: matchedProduct.id },
          create: { businessId, productId: matchedProduct.id, quantity, reservedQuantity: 0 },
          update: { quantity: { increment: quantity } },
          select: { quantity: true, reservedQuantity: true },
        });
        await tx.stockMovement.create({ data: { productId: matchedProduct.id, userId, movementType: "RESTOCK_IN", quantity, reference: `SCAN-RESTOCK-${scanEvent.id}`, notes: String(body.reason ?? "Restocked from barcode scan") } });
        await tx.auditLog.create({ data: { businessId, userId, action: "SCAN_RESTOCK", tableName: "Inventory", recordId: matchedProduct.id, deviceId: null } });
        return inventory;
      });
      return NextResponse.json({ success: true, action, scanId: scanEvent.id, product: { ...productResponse(matchedProduct), stock: result.quantity, reservedStock: result.reservedQuantity } }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      action,
      scanId: scanEvent.id,
      status: "FOUND",
      product: productResponse(matchedProduct),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: "Failed to persist scan event.",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}