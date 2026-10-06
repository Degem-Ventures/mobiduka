import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";
import { composeProductDisplayName } from "@/lib/product-display-name";

function optionalIdentityText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim().replace(/\s+/g, " ") || null;
}

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
    const popularityStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [products, recentSales] = await Promise.all([
      prisma.product.findMany({
        where: { businessId, ...(includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null }) },
        include: {
          category: { select: { id: true, name: true, emoji: true } },
          inventory: { select: { quantity: true } },
        },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: {
            is: {
              businessId,
              saleStatus: "COMPLETED",
              createdAt: { gte: popularityStart },
            },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
      }),
    ]);
    const unitsSoldByProduct = new Map(
      recentSales.map((sale) => [sale.productId, sale._sum.quantity ?? 0]),
    );

    return NextResponse.json(
      products.map((product) => ({
        ...product,
        recentUnitsSold: unitsSoldByProduct.get(product.id) ?? 0,
      })),
    );
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

    const hasStructuredIdentity =
      body.brand !== undefined ||
      body.productType !== undefined ||
      body.packSize !== undefined;
    const productType = String(body.productType ?? body.name ?? "").trim();
    if (hasStructuredIdentity && !productType) {
      return NextResponse.json({ error: "Product name is required." }, { status: 400 });
    }
    const brand = optionalIdentityText(body.brand);
    const packSize = optionalIdentityText(body.packSize);

    const product = await prisma.product.create({
      data: {
        businessId,
        name: hasStructuredIdentity
          ? composeProductDisplayName(brand, productType, packSize)
          : String(body.name ?? "").trim(),
        ...(hasStructuredIdentity ? { brand, productType, packSize } : {}),
        sellingPrice: Number(body.sellingPrice ?? body.price ?? 0),
        costPrice: Number(body.costPrice ?? 0),
        trackStock: body.trackStock !== false,
        status: String(body.status ?? "ACTIVE"),
        sku: body.sku ? String(body.sku).trim() : null,
        barcode: body.barcode ? String(body.barcode) : null,
        categoryId: body.categoryId ? String(body.categoryId) : null,
        emoji: body.emoji ? String(body.emoji) : null,
        minimumStock: Number.isFinite(Number(body.minimumStock)) ? Number(body.minimumStock) : null,
        syncStatus: "SYNCED",
        inventory: {
          create: {
            businessId,
            quantity: Number.isFinite(Number(body.stock)) ? Number(body.stock) : 0,
            reservedQuantity: 0,
          },
        },
      },
    });

    await createSystemNotification({
      businessId,
      type: "info",
      title: "New Product Added",
      body: `${product.name} has been added to the product catalogue.`,
      eventKey: `product-created:${product.id}`,
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const productId = typeof body.id === "string" ? body.id.trim() : new URL(request.url).searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId || !productId) {
      return NextResponse.json({ error: "Authenticated business context and product id are required." }, { status: 400 });
    }

    const existing = await prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!existing) return NextResponse.json({ error: "Product was not found." }, { status: 404 });

    if (body.restore === true) {
      if (!existing.deletedAt) return NextResponse.json({ error: "Product is already active." }, { status: 400 });
      const product = await prisma.product.update({ where: { id: productId }, data: { deletedAt: null, status: "ACTIVE" } });
      return NextResponse.json(product);
    }
    if (existing.deletedAt) return NextResponse.json({ error: "Restore this product before editing it." }, { status: 409 });

    const categoryId = body.categoryId === undefined ? existing.categoryId : body.categoryId ? String(body.categoryId) : null;
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, businessId }, select: { id: true } });
      if (!category) return NextResponse.json({ error: "Category does not belong to this business." }, { status: 400 });
    }

    const numericFields = ["costPrice", "sellingPrice", "minimumStock", "stock"];
    for (const field of numericFields) {
      if (body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
        return NextResponse.json({ error: `${field} must be a non-negative number.` }, { status: 400 });
      }
    }

    const structuredIdentityProvided =
      body.brand !== undefined ||
      body.productType !== undefined ||
      body.packSize !== undefined;
    const identityData: {
      name?: string;
      brand?: string | null;
      productType?: string | null;
      packSize?: string | null;
    } = {};
    if (structuredIdentityProvided) {
      const brand = body.brand === undefined
        ? existing.brand
        : optionalIdentityText(body.brand);
      const productType = body.productType === undefined
        ? body.name === undefined
          ? existing.productType ?? existing.name
          : String(body.name).trim()
        : String(body.productType).trim();
      const packSize = body.packSize === undefined
        ? existing.packSize
        : optionalIdentityText(body.packSize);
      if (!productType) {
        return NextResponse.json({ error: "Product name is required." }, { status: 400 });
      }
      Object.assign(identityData, {
        name: composeProductDisplayName(brand, productType, packSize),
        brand,
        productType,
        packSize,
      });
    } else if (body.name !== undefined) {
      identityData.name = String(body.name).trim();
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          ...identityData,
          ...(body.sku !== undefined ? { sku: body.sku ? String(body.sku).trim() : null } : {}),
          ...(body.barcode !== undefined ? { barcode: body.barcode ? String(body.barcode).trim() : null } : {}),
          ...(body.costPrice !== undefined ? { costPrice: Number(body.costPrice) } : {}),
          ...(body.sellingPrice !== undefined ? { sellingPrice: Number(body.sellingPrice) } : {}),
          ...(body.minimumStock !== undefined ? { minimumStock: Number(body.minimumStock) } : {}),
          ...(body.emoji !== undefined ? { emoji: body.emoji ? String(body.emoji).trim() : null } : {}),
          ...(body.categoryId !== undefined ? { categoryId } : {}),
          ...(body.trackStock !== undefined ? { trackStock: body.trackStock !== false } : {}),
          ...(body.status !== undefined ? { status: String(body.status) } : {}),
        },
      });

      if (body.stock !== undefined) {
        await tx.inventory.upsert({
          where: { productId },
          create: { businessId, productId, quantity: Number(body.stock), reservedQuantity: 0 },
          update: { quantity: Number(body.stock) },
        });
      }
      return updated;
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, url.searchParams.get("businessId"));
    const hardDelete = url.searchParams.get("hard") === "true";
    if (!businessId || !productId) {
      return NextResponse.json({ error: "Authenticated business context and product id are required." }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
        deletedAt: hardDelete ? { not: null } : null,
      },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: "Product was not found." }, { status: 404 });

    if (!hardDelete) {
      await prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date(), status: "DELETED" } });
      return NextResponse.json({ success: true, deleted: "soft" });
    }

    const blocked = await prisma.$transaction(async (tx) => {
      const references = await tx.product.findUnique({
        where: { id: productId },
        select: {
          saleItems: { select: { id: true }, take: 1 },
          purchaseItems: { select: { id: true }, take: 1 },
          stockMoves: { select: { id: true }, take: 1 },
          scanEvents: { select: { id: true }, take: 1 },
        },
      });
      if (
        references?.saleItems.length ||
        references?.purchaseItems.length ||
        references?.stockMoves.length ||
        references?.scanEvents.length
      ) return true;

      await tx.inventory.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
      return false;
    });
    if (blocked) {
      return NextResponse.json(
        { error: "This product has sales, purchase, stock, or scan history and cannot be permanently deleted. It will remain in deleted products." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, deleted: "hard" });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 400 });
  }
}
