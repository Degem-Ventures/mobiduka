import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        name: String(body.name ?? ""),
        sellingPrice: Number(body.sellingPrice ?? body.price ?? 0),
        costPrice: Number(body.costPrice ?? 0),
        trackStock: body.trackStock !== false,
        status: String(body.status ?? "ACTIVE"),
        sku: String(body.sku ?? ""),
        barcode: body.barcode ? String(body.barcode) : null,
        syncStatus: "SYNCED",
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 400 },
    );
  }
}
