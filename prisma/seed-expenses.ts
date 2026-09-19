import { PrismaClient } from "@prisma/client";
import { demoExpenses } from "../data/demo-expenses";

const prisma = new PrismaClient();

function iconForExpense(description: string, category: string | null) {
  const text = `${description} ${category ?? ""}`.toLowerCase();
  if (text.includes("rent")) return "🏪";
  if (text.includes("salary") || text.includes("payroll") || text.includes("nhif")) return "👥";
  if (text.includes("transport") || text.includes("delivery")) return "🚚";
  if (text.includes("clean")) return "🧹";
  if (text.includes("packag") || text.includes("suppl")) return "🛍️";
  if (text.includes("internet") || text.includes("data")) return "📶";
  if (text.includes("electric") || text.includes("water") || text.includes("utilit")) return "⚡";
  return "💸";
}

function categoryForExpense(category: string | null) {
  const value = category?.trim().toLowerCase();
  const known: Record<string, string> = {
    utilities: "Utilities",
    payroll: "Payroll",
    rent: "Rent",
    supplies: "Supplies",
    logistics: "Logistics",
  };
  return known[value ?? ""] ?? category;
}

function paymentMethodForExpense(description: string, category: string | null) {
  const text = `${description} ${category ?? ""}`.toLowerCase();
  if (text.includes("rent") || text.includes("salary") || text.includes("payroll") || text.includes("nhif")) return "Bank";
  if (text.includes("electric") || text.includes("water") || text.includes("utilit") || text.includes("internet") || text.includes("data")) return "M-Pesa";
  return "Cash";
}

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error("BUSINESS_ID is required");

  const user = await prisma.user.findFirst({ where: { businessId }, select: { id: true } });
  if (!user) throw new Error(`No user found for business: ${businessId}`);

  const allExpenses = await prisma.expense.findMany({
    where: { businessId },
    select: { id: true, description: true, category: true, paymentMethod: true, icon: true },
  });
  for (const expense of allExpenses) {
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        category: categoryForExpense(expense.category),
        paymentMethod: expense.paymentMethod ?? paymentMethodForExpense(expense.description, expense.category),
        icon: expense.icon ?? iconForExpense(expense.description, expense.category),
      },
    });
  }

  for (const expense of demoExpenses) {
    const createdAt = new Date(`${expense.date}T12:00:00.000Z`);
    const existing = await prisma.expense.findFirst({
      where: { businessId, description: expense.description, category: expense.category, createdAt },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.expense.create({
      data: {
        businessId,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        icon: expense.icon,
        recurring: expense.recurring,
        recordedBy: user.id,
        createdAt,
      },
    });
  }

  const expenses = await prisma.expense.findMany({
    where: { businessId },
    select: { description: true, category: true, amount: true, paymentMethod: true, recurring: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(expenses, null, 2));
}

main()
  .catch((error) => {
    console.error("Expense seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });