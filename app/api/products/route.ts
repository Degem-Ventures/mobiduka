import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getDefaultBusiness() {
  const existing = await prisma.business.findFirst();

  if (existing) {
    return existing;
  }

  return prisma.business.create({
    data: {
      name: "MobiDuka Demo Store",
      businessType: "retail",
      country: "Kenya",
      currency: "KES",
      timezone: "Africa/Nairobi",
      subscriptionPlan: "starter",
      status: "ACTIVE",
    },
  });
}

export async function GET() {
  try {
    const business = await getDefaultBusiness();
    const products = await prisma.product.findMany({
      where: { businessId: business.id },
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
    const business = await getDefaultBusiness();

    const product = await prisma.product.create({
      data: {
        businessId: business.id,
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
