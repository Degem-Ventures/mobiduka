import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }

    const expenses = await prisma.expense.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load expenses ledger.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, businessId, userId, category, amount, description, paidTo } = body;
    const parsedAmount = Number(amount);
    const normalizedDescription = typeof description === "string" ? description.trim() : "";

    if (!businessId || !userId || !category || !normalizedDescription || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "businessId, userId, category, description, and a positive amount are required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, businessId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User does not belong to this business." }, { status: 404 });

    const expense = await prisma.$transaction(async (tx) => {
      const record = await tx.expense.create({
        data: {
          id: id || undefined,
          businessId,
          category: String(category).trim(),
          description: normalizedDescription,
          amount: parsedAmount,
          paidTo: paidTo ? String(paidTo).trim() : null,
          recordedBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "EXPENSE_LOGGED",
          tableName: "Expense",
          recordId: record.id,
        },
      });
      return record;
    });

    return NextResponse.json({ success: true, expenseId: expense.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Expense registration failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
