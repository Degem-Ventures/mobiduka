import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
    const categories = await prisma.category.findMany({
      where: { businessId, ...(includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null }) },
      select: {
        id: true,
        name: true,
        emoji: true,
        parentCategoryId: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = requireBusinessAccess(request, body.businessId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const emoji = typeof body.emoji === "string" ? body.emoji.trim() : null;

    if (!businessId || !name) {
      return NextResponse.json(
        { error: "Authenticated business context and category name are required." },
        { status: 400 },
      );
    }

    const existing = await prisma.category.findFirst({ where: { businessId, name, deletedAt: null } });
    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    const category = await prisma.category.create({
      data: {
        businessId,
        name,
        emoji,
        parentCategoryId: body.parentCategoryId ? String(body.parentCategoryId) : null,
      },
    });

    await createSystemNotification({
      businessId,
      type: "info",
      title: "New Product Category Added",
      body: `${category.name} has been added to the product categories.`,
      eventKey: `category-created:${category.id}`,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const categoryId = typeof body.id === "string" ? body.id.trim() : new URL(request.url).searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId || !categoryId) return NextResponse.json({ error: "Authenticated business context and category id are required." }, { status: 400 });

    const existing = await prisma.category.findFirst({ where: { id: categoryId, businessId }, select: { id: true, name: true, deletedAt: true } });
    if (!existing) return NextResponse.json({ error: "Category was not found." }, { status: 404 });
    if (body.restore === true) {
      if (!existing.deletedAt) return NextResponse.json({ error: "Category is already active." }, { status: 400 });
      const category = await prisma.category.update({ where: { id: categoryId }, data: { deletedAt: null, status: "ACTIVE" } });
      return NextResponse.json(category);
    }
    if (existing.deletedAt) return NextResponse.json({ error: "Restore this category before editing it." }, { status: 409 });
    const name = body.name === undefined ? existing.name : String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    const duplicate = await prisma.category.findFirst({ where: { businessId, name, id: { not: categoryId } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name,
        ...(body.emoji !== undefined ? { emoji: body.emoji ? String(body.emoji).trim() : null } : {}),
        ...(body.parentCategoryId !== undefined ? { parentCategoryId: body.parentCategoryId ? String(body.parentCategoryId) : null } : {}),
      },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, url.searchParams.get("businessId"));
    const hardDelete = url.searchParams.get("hard") === "true";
    if (!businessId || !categoryId) return NextResponse.json({ error: "Authenticated business context and category id are required." }, { status: 400 });

    if (hardDelete) {
      const result = await prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
          where: { id: categoryId, businessId, deletedAt: { not: null } },
          select: { id: true },
        });
        if (!category) return "NOT_FOUND" as const;

        const [activeProductCount, childCategoryCount] = await Promise.all([
          tx.product.count({ where: { categoryId, businessId, deletedAt: null } }),
          tx.category.count({ where: { parentCategoryId: categoryId, businessId } }),
        ]);
        if (activeProductCount || childCategoryCount) return "IN_USE" as const;

        await tx.product.updateMany({
          where: { categoryId, businessId, deletedAt: { not: null } },
          data: { categoryId: null },
        });
        await tx.category.delete({ where: { id: categoryId } });
        return "DELETED" as const;
      });
      if (result === "NOT_FOUND") {
        return NextResponse.json({ error: "Deleted category was not found." }, { status: 404 });
      }
      if (result === "IN_USE") {
        return NextResponse.json(
          { error: "This category still has active products or child categories. Remove or move them before permanently deleting the category." },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true, deleted: "hard" });
    }

    const category = await prisma.category.findFirst({ where: { id: categoryId, businessId, deletedAt: null }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "Category was not found." }, { status: 404 });
    const [productCount, childCategoryCount] = await Promise.all([
      prisma.product.count({ where: { categoryId, businessId, deletedAt: null } }),
      prisma.category.count({ where: { parentCategoryId: categoryId, businessId } }),
    ]);
    if (productCount || childCategoryCount) {
      return NextResponse.json({ error: "Category cannot be deleted while it has products or child categories." }, { status: 409 });
    }

    await prisma.category.update({ where: { id: categoryId }, data: { deletedAt: new Date(), status: "DELETED" } });
    return NextResponse.json({ success: true, deleted: "soft" });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 400 });
  }
}
