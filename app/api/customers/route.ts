import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = requireBusinessAccess(request, searchParams.get("businessId"));
    const query = searchParams.get("query")?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const customerId = searchParams.get("customerId");
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId },
        include: {
          creditAccount: { select: { balance: true, status: true, lastPayment: true } },
          sales: {
            include: {
              payments: { include: { paymentMethod: { select: { name: true } } } },
              items: { select: { quantity: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          creditEntries: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!customer) return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
      return NextResponse.json(customer);
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        creditAccount: { select: { balance: true, status: true } },
        _count: { select: { sales: true, creditEntries: true } },
        sales: { select: { id: true, createdAt: true, total: true }, orderBy: { createdAt: "desc" }, take: 1 },
        creditEntries: { select: { id: true, type: true, amount: true, paymentMethod: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load customer profiles.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, businessId, name, phone, initialCreditLimit } = body;
    const resolvedBusinessId = requireBusinessAccess(request, businessId);
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : null;
    const creditLimit = initialCreditLimit === undefined ? 0 : Number(initialCreditLimit);

    if (!resolvedBusinessId || !normalizedName) {
      return NextResponse.json({ error: "Authenticated business context and name are required." }, { status: 401 });
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      return NextResponse.json({ error: "initialCreditLimit must be a non-negative number." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (id) {
        const existingById = await tx.customer.findUnique({ where: { id }, select: { businessId: true } });
        if (existingById && existingById.businessId !== resolvedBusinessId) {
          throw new Error("Customer does not belong to this business.");
        }
      }

      if (normalizedPhone) {
        const existing = await tx.customer.findFirst({ where: { businessId: resolvedBusinessId, phone: normalizedPhone }, select: { id: true } });
        if (existing && existing.id !== id) throw new Error("A customer with this phone number already exists.");
      }

      const customer = id
        ? await tx.customer.upsert({
            where: { id },
            update: { name: normalizedName, phone: normalizedPhone, creditLimit, updatedAt: new Date() },
            create: { id, businessId: resolvedBusinessId, name: normalizedName, phone: normalizedPhone, creditLimit },
          })
        : await tx.customer.create({
            data: { businessId: resolvedBusinessId, name: normalizedName, phone: normalizedPhone, creditLimit },
          });

      const creditAccount = await tx.creditAccount.upsert({
        where: { customerId: customer.id },
        update: {},
        create: { customerId: customer.id, balance: 0, status: "ACTIVE" },
      });

      return { customer, creditAccount };
    });

    if (!id) {
      await createSystemNotification({
        businessId: resolvedBusinessId,
        type: "success",
        title: "New Customer Registered",
        body: `${result.customer.name} has been added as a new customer.${creditLimit > 0 ? ` Credit limit: KSh ${creditLimit.toLocaleString("en-KE")}.` : ""}`,
        eventKey: `customer-created:${result.customer.id}`,
      });
    }

    return NextResponse.json(
      { success: true, customerId: result.customer.id, message: "Customer profile registered successfully." },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Customer registration failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const businessId = requireBusinessAccess(request, body.businessId);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const creditLimit = body.initialCreditLimit === undefined ? undefined : Number(body.initialCreditLimit);
    if (!businessId || !id || !name) return NextResponse.json({ error: "Authenticated business context, customer id, and name are required." }, { status: 400 });
    if (creditLimit !== undefined && (!Number.isFinite(creditLimit) || creditLimit < 0)) return NextResponse.json({ error: "initialCreditLimit must be a non-negative number." }, { status: 400 });
    const existing = await prisma.customer.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
    if (phone) {
      const duplicate = await prisma.customer.findFirst({ where: { businessId, phone, id: { not: id } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "A customer with this phone number already exists." }, { status: 409 });
    }
    const customer = await prisma.customer.update({ where: { id }, data: { name, phone, ...(creditLimit === undefined ? {} : { creditLimit }) } });
    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update customer.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = requireBusinessAccess(request, url.searchParams.get("businessId"));
    const id = url.searchParams.get("id")?.trim();
    if (!businessId || !id) return NextResponse.json({ error: "Authenticated business context and customer id are required." }, { status: 400 });
    const customer = await prisma.customer.findFirst({ where: { id, businessId }, include: { _count: { select: { sales: true, creditEntries: true } } } });
    if (!customer) return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
    if (customer._count.sales || customer._count.creditEntries) return NextResponse.json({ error: "Customers with sales or credit history cannot be deleted." }, { status: 409 });
    await prisma.$transaction(async tx => {
      await tx.creditAccount.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete customer.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
