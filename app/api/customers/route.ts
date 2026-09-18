import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = requireBusinessAccess(request, searchParams.get("businessId"));
    const query = searchParams.get("query")?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
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
