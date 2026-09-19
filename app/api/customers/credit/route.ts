import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

const toPositiveAmount = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, businessId, customerId, amount, dueDate, creditBookId, userId } = body;
    const resolvedBusinessId = requireBusinessAccess(request, businessId);

    if (!resolvedBusinessId || !customerId || !action) {
      return NextResponse.json(
        { error: "Authenticated business context, customer, and action are required." },
        { status: 401 },
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: resolvedBusinessId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer does not belong to this business or could not be found." },
        { status: 404 },
      );
    }

    const parsedAmount = toPositiveAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json(
        { error: "Amount must be a positive number." },
        { status: 400 },
      );
    }

    if (action === "CHARGE_CREDIT") {
      const parsedDueDate = dueDate ? new Date(dueDate) : null;
      if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
        return NextResponse.json({ error: "Due date must be a valid date." }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.creditAccount.upsert({
          where: { customerId },
          update: { balance: { increment: parsedAmount }, status: "ACTIVE" },
          create: { customerId, balance: parsedAmount, status: "ACTIVE" },
        });

        const entry = await tx.creditLedgerEntry.create({
          data: {
            id: creditBookId || undefined,
            businessId: resolvedBusinessId,
            customerId,
            type: "CHARGE",
            amount: parsedAmount,
            dueDate: parsedDueDate,
            status: "PENDING",
          },
        });

        return { entry, balance: account.balance };
      });

      return NextResponse.json(
        {
          success: true,
          creditBookId: result.entry.id,
          status: result.entry.status,
          outstandingBalance: result.balance,
        },
        { status: 201 },
      );
    }

    if (action === "RECORD_PAYMENT") {
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.creditAccount.findUnique({
          where: { customerId },
          select: { balance: true },
        });

        if (!account || account.balance < parsedAmount) {
          return null;
        }

        const nextBalance = account.balance - parsedAmount;
        const updatedAccount = await tx.creditAccount.update({
          where: { customerId },
          data: {
            balance: nextBalance,
            lastPayment: new Date(),
            status: nextBalance === 0 ? "CLEARED" : "ACTIVE",
          },
        });

        const entry = await tx.creditLedgerEntry.create({
          data: {
            businessId,
            customerId,
            type: "PAYMENT",
            amount: parsedAmount,
            status: "COMPLETED",
          },
        });

        await tx.auditLog.create({
          data: {
            businessId: resolvedBusinessId,
            userId: userId || null,
            action: "CREDIT_REPAYMENT",
            tableName: "CreditLedgerEntry",
            recordId: entry.id,
          },
        });

        return { entry, balance: updatedAccount.balance };
      });

      if (!result) {
        return NextResponse.json(
          { error: "Repayment exceeds the customer's outstanding balance." },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        creditBookId: result.entry.id,
        message: "Debt collection payment recorded successfully.",
        outstandingBalance: result.balance,
      });
    }

    return NextResponse.json(
      { error: "Unsupported credit operation instruction." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal credit ledger system failure.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
