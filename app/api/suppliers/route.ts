import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

const supplierSelect = {
  id: true,
  name: true,
  category: true,
  phone: true,
  email: true,
  location: true,
  contactPerson: true,
  notes: true,
  paymentTerms: true,
  rating: true,
  outstandingBalance: true,
  createdAt: true,
  _count: { select: { products: true, purchaseOrders: true } },
} as const;

function normalizeOptional(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRating(value: unknown) {
  const rating = Number(value)
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5
}

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });

    const suppliers = await prisma.supplier.findMany({
      where: { businessId },
      select: supplierSelect,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = requireBusinessAccess(request, body.businessId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!businessId || !name) return NextResponse.json({ error: "Authenticated business context and supplier name are required." }, { status: 400 });

    const duplicate = await prisma.supplier.findFirst({ where: { businessId, name }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "A supplier with this name already exists." }, { status: 409 });

    const supplier = await prisma.supplier.create({
      data: {
        businessId,
        name,
        category: normalizeOptional(body.category),
        phone: normalizeOptional(body.phone),
        email: normalizeOptional(body.email),
        location: normalizeOptional(body.location),
        contactPerson: normalizeOptional(body.contactPerson ?? body.contact),
        notes: normalizeOptional(body.notes),
        paymentTerms: normalizeOptional(body.paymentTerms) ?? "Net 30",
        rating: normalizeRating(body.rating),
        outstandingBalance: Number.isFinite(Number(body.outstandingBalance)) && Number(body.outstandingBalance) >= 0 ? Number(body.outstandingBalance) : 0,
      },
      select: supplierSelect,
    });
    await createSystemNotification({
      businessId,
      type: "info",
      title: "New Supplier Added",
      body: `${supplier.name} has been added to the supplier directory.`,
      eventKey: `supplier-created:${supplier.id}`,
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supplierId = typeof body.id === "string" ? body.id.trim() : new URL(request.url).searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId || !supplierId) return NextResponse.json({ error: "Authenticated business context and supplier id are required." }, { status: 400 });

    const existing = await prisma.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true, name: true } });
    if (!existing) return NextResponse.json({ error: "Supplier was not found." }, { status: 404 });
    const name = body.name === undefined ? existing.name : String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
    const duplicate = await prisma.supplier.findFirst({ where: { businessId, name, id: { not: supplierId } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "A supplier with this name already exists." }, { status: 409 });

    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name,
        ...(body.category !== undefined ? { category: normalizeOptional(body.category) } : {}),
        ...(body.phone !== undefined ? { phone: normalizeOptional(body.phone) } : {}),
        ...(body.email !== undefined ? { email: normalizeOptional(body.email) } : {}),
        ...(body.location !== undefined ? { location: normalizeOptional(body.location) } : {}),
        ...(body.contactPerson !== undefined || body.contact !== undefined ? { contactPerson: normalizeOptional(body.contactPerson ?? body.contact) } : {}),
        ...(body.notes !== undefined ? { notes: normalizeOptional(body.notes) } : {}),
        ...(body.paymentTerms !== undefined ? { paymentTerms: normalizeOptional(body.paymentTerms) ?? "Net 30" } : {}),
        ...(body.rating !== undefined ? { rating: normalizeRating(body.rating) } : {}),
        ...(body.outstandingBalance !== undefined && Number.isFinite(Number(body.outstandingBalance)) && Number(body.outstandingBalance) >= 0 ? { outstandingBalance: Number(body.outstandingBalance) } : {}),
      },
      select: supplierSelect,
    });
    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Failed to update supplier:", error);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const supplierId = url.searchParams.get("id")?.trim();
    const businessId = requireBusinessAccess(request, url.searchParams.get("businessId"));
    if (!businessId || !supplierId) return NextResponse.json({ error: "Authenticated business context and supplier id are required." }, { status: 400 });

    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true, _count: { select: { products: true, purchaseOrders: true } } } });
    if (!supplier) return NextResponse.json({ error: "Supplier was not found." }, { status: 404 });
    if (supplier._count.products || supplier._count.purchaseOrders) return NextResponse.json({ error: "Supplier cannot be deleted while it has products or purchase orders." }, { status: 409 });

    await prisma.supplier.delete({ where: { id: supplierId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 400 });
  }
}
