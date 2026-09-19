import { PrismaClient } from "@prisma/client";
import { demoCustomers } from "../data/demo-customers";

const prisma = new PrismaClient();

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error("BUSINESS_ID is required");

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!business) throw new Error(`Business not found: ${businessId}`);

  for (const customerSeed of demoCustomers) {
    const existing = await prisma.customer.findFirst({
      where: { businessId, phone: customerSeed.phone },
      select: { id: true },
    });
    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: customerSeed.name,
            creditLimit: Math.max(customerSeed.credit, customerSeed.creditCharge),
          },
          include: { creditAccount: true },
        })
      : await prisma.customer.create({
          data: {
            businessId,
            name: customerSeed.name,
            phone: customerSeed.phone,
            creditLimit: Math.max(customerSeed.credit, customerSeed.creditCharge),
            creditAccount: {
              create: {
                balance: customerSeed.credit,
                status: customerSeed.credit > 0 ? "ACTIVE" : "CLEARED",
              },
            },
          },
          include: { creditAccount: true },
        });

    if (customer.creditAccount) {
      await prisma.creditAccount.update({
        where: { customerId: customer.id },
        data: {
          balance: customerSeed.credit,
          status: customerSeed.credit > 0 ? "ACTIVE" : "CLEARED",
        },
      });
    } else {
      await prisma.creditAccount.create({
        data: {
          customerId: customer.id,
          balance: customerSeed.credit,
          status: customerSeed.credit > 0 ? "ACTIVE" : "CLEARED",
        },
      });
    }

    const existingEntries = await prisma.creditLedgerEntry.count({ where: { customerId: customer.id } });
    if (existingEntries === 0) {
      await prisma.creditLedgerEntry.createMany({
        data: [
          { businessId, customerId: customer.id, type: "CHARGE", amount: customerSeed.creditCharge, status: "PENDING" },
          ...(customerSeed.creditPayment > 0
            ? [{ businessId, customerId: customer.id, type: "PAYMENT", amount: customerSeed.creditPayment, status: "COMPLETED" }]
            : []),
        ],
      });
    }
  }

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: {
      name: true,
      creditAccount: { select: { balance: true, status: true } },
      _count: { select: { creditEntries: true } },
    },
    orderBy: { name: "asc" },
  });
  console.log(JSON.stringify(customers, null, 2));
}

main()
  .catch((error) => {
    console.error("Customer seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });