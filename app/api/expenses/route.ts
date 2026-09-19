import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { sendPushNotification } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
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
    const resolvedBusinessId = requireBusinessAccess(request, businessId);
    const requestedExpenseId = typeof id === "string" && id.trim() && id.trim().toLowerCase() !== "string"
      ? id.trim()
      : undefined;
    const parsedAmount = Number(amount);
    const normalizedDescription = typeof description === "string" ? description.trim() : "";

    if (!resolvedBusinessId || !userId || !category || !normalizedDescription || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Authenticated business context, userId, category, description, and a positive amount are required." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, businessId: resolvedBusinessId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User does not belong to this business." }, { status: 404 });

    const expense = await prisma.$transaction(async (tx) => {
      const record = await tx.expense.create({
        data: {
          id: requestedExpenseId,
          businessId: resolvedBusinessId,
          category: String(category).trim(),
          description: normalizedDescription,
          amount: parsedAmount,
          paidTo: paidTo ? String(paidTo).trim() : null,
          recordedBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId,
          action: "EXPENSE_LOGGED",
          tableName: "Expense",
          recordId: record.id,
        },
      });
      return record;
    });

    const alertThreshold = Number.parseFloat(process.env.EXPENSE_ALERT_THRESHOLD_KES ?? "5000");
    if (parsedAmount >= (Number.isFinite(alertThreshold) ? alertThreshold : 5000)) {
      await sendPushNotification(
        `business_expenses_${businessId}`,
        "⚠️ Large Store Outflow Logged",
        `${String(category).trim()}: KSh ${parsedAmount.toFixed(2)}. ${normalizedDescription}`,
        {
          businessId: resolvedBusinessId,
          expenseId: expense.id,
          amount: parsedAmount.toFixed(2),
          category: String(category).trim(),
        },
      );
    }

    return NextResponse.json({ success: true, expenseId: expense.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Expense registration failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
