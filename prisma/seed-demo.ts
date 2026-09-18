import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoProducts } from "../data/demo-products";

const requestedForceSeed = process.argv.includes("--force-seed-demo");
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
const nodeEnv = (process.env.NODE_ENV ?? "").trim();
const isProductionLikeDatabase =
  /(neon|postgres|prod|production|merchant|live)/i.test(databaseUrl) ||
  nodeEnv === "production";

if (isProductionLikeDatabase && !requestedForceSeed) {
  console.error("\n⚠️ SEED ABORTED: live production-like database detected.");
  console.error(`NODE_ENV: ${nodeEnv || "not set"}`);
  console.error(`DATABASE_URL: ${databaseUrl ? `${databaseUrl.slice(0, 80)}...` : "not set"}`);
  console.error("Re-run with --force-seed-demo to allow demo seeding only for a controlled environment.");
  process.exit(1);
}

if (isProductionLikeDatabase && requestedForceSeed) {
  console.warn("⚠️ WARNING: --force-seed-demo supplied. Seeding is running against a production-like database target.");
}

const prisma = new PrismaClient();

function atStartOfDay(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function dateAt(day: Date, hour: number, minute: number) {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function toIso(date: Date) {
  return new Date(date).toISOString();
}

async function clearDatabase() {
  await prisma.syncQueue.deleteMany({});
  await prisma.mpesaTransaction.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.paymentMethod.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.creditLedgerEntry.deleteMany({});
  await prisma.creditAccount.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.cashSession.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.license.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.business.deleteMany({});
  await prisma.role.deleteMany({});
}

async function main() {
  console.log("Starting 30-day MobiDuka demo seed...");
  await clearDatabase();

  const business = await prisma.business.create({
    data: {
      name: "MobiDuka Wholesale Eldoret",
      businessType: "retail",
      ownerName: "John Kamau",
      phone: "+254700000001",
      email: "owner@mobiduka.com",
      country: "Kenya",
      currency: "KES",
      timezone: "Africa/Nairobi",
      subscriptionPlan: "starter",
      status: "ACTIVE",
    },
  });

  const [ownerRole, managerRole, cashierRole] = await prisma.$transaction([
    prisma.role.create({ data: { name: "OWNER", description: "Store owner" } }),
    prisma.role.create({ data: { name: "MANAGER", description: "Store manager" } }),
    prisma.role.create({ data: { name: "CASHIER", description: "Shift cashier" } }),
  ]);

  const passwordHash = await bcrypt.hash("OwnerPass123", 10);
  const [, cashierOne, cashierTwo] = await prisma.$transaction([
    prisma.user.create({
      data: {
        businessId: business.id,
        email: "owner@mobiduka.com",
        fullName: "John Kamau",
        roleId: ownerRole.id,
        passwordHash,
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        businessId: business.id,
        email: "cashier1@mobiduka.com",
        username: "cashier1",
        fullName: "Faith Mutua",
        roleId: cashierRole.id,
        pinHash: await bcrypt.hash("2540", 10),
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        businessId: business.id,
        email: "cashier2@mobiduka.com",
        username: "cashier2",
        fullName: "Kevin Ochieng",
        roleId: cashierRole.id,
        pinHash: await bcrypt.hash("2541", 10),
        status: "ACTIVE",
      },
    }),
  ]);
  void managerRole;

  await prisma.device.create({
    data: {
      id: "f9fe7e90-cff9-4e99-8335-d33eea68a8ec",
      businessId: business.id,
      userId: cashierOne.id,
      deviceUuid: "flutter-pos-hardware-token-12345",
      deviceName: "Main Counter Tablet",
      deviceModel: "Android Tablet",
      platform: "android",
      status: "ACTIVE",
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "MobiDuka Distribution Hub",
      phone: "+254700112233",
      email: "supplies@mobiduka.com",
      location: "Nairobi",
      contactPerson: "Grace Achieng",
    },
  });

  const category = await prisma.category.create({
    data: { businessId: business.id, name: "Fast Moving Consumer Goods" },
  });

  const productRecords = await prisma.$transaction(
    demoProducts.map(([name, sku, barcode, costPrice, sellingPrice, minimumStock, stock]) =>
      prisma.product.create({
        data: {
          businessId: business.id,
          categoryId: category.id,
          supplierId: supplier.id,
          name,
          sku,
          barcode,
          unit: "piece",
          costPrice,
          sellingPrice,
          minimumStock,
          trackStock: true,
          status: "ACTIVE",
          syncStatus: "SYNCED",
          inventory: {
            create: {
              businessId: business.id,
              quantity: stock,
              reservedQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      }),
    ),
  );

  const [cashPayment, mpesaPayment] = await prisma.$transaction([
    prisma.paymentMethod.create({ data: { name: "CASH" } }),
    prisma.paymentMethod.create({ data: { name: "MPESA" } }),
  ]);

  let saleCount = 0;
  let expenseCount = 0;

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const day = atStartOfDay(daysAgo);
    const cashier = daysAgo % 2 === 0 ? cashierOne : cashierTwo;
    const openingBalance = 2500 + (daysAgo % 4) * 500;
    const saleCountForDay = 3 + (daysAgo % 6);
    const dailyBatch: Array<ReturnType<typeof prisma.sale.create>> = [];
    const saleRows: Array<{ total: number }> = [];

    for (let saleIndex = 0; saleIndex < saleCountForDay; saleIndex += 1) {
      const selected = [0, 1, 2].map(
        (offset) => productRecords[(daysAgo * 3 + saleIndex + offset) % productRecords.length],
      );
      const createdAt = dateAt(day, 8 + (saleIndex % 9), (saleIndex * 13) % 60);
      const items = selected.map((product, itemIndex) => {
        const quantity = 1 + ((daysAgo + saleIndex + itemIndex) % 3);
        const unitPrice = product.sellingPrice ?? 0;
        return {
          productId: product.id,
          quantity,
          unitPrice,
          total: Number((unitPrice * quantity).toFixed(2)),
        };
      });

      const subtotal = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
      const discount = saleIndex % 5 === 0 ? 10 : 0;
      const total = Number((subtotal - discount).toFixed(2));
      const paymentMethod = (saleIndex + daysAgo) % 3 === 0 ? mpesaPayment : cashPayment;

      dailyBatch.push(
        prisma.sale.create({
          data: {
            businessId: business.id,
            cashierId: cashier.id,
            saleNumber: `DEMO-${daysAgo + 1}-${saleIndex + 1}`,
            subtotal,
            discount,
            total,
            paymentStatus: "PAID",
            saleStatus: "COMPLETED",
            createdAt: toIso(createdAt),
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: 0,
                tax: 0,
                total: item.total,
              })),
            },
            payments: {
              create: {
                paymentMethodId: paymentMethod.id,
                amount: total,
                reference: paymentMethod.name === "MPESA" ? `QX${daysAgo}${saleIndex}DEMO` : null,
                receivedAt: toIso(createdAt),
              },
            },
          },
        }),
      );

      saleRows.push({ total });
    }

    const dailySales = await prisma.$transaction(dailyBatch);
    saleCount += dailySales.length;

    const cashSales = Number(
      (saleRows.reduce((sum, sale) => sum + sale.total, 0) * 0.66).toFixed(2),
    );
    const hasExpense = (29 - daysAgo) % 5 === 0;
    const expenseAmount = hasExpense ? (daysAgo % 10 === 0 ? 6500 : 2800 + (daysAgo % 3) * 400) : 0;
    const expectedBalance = Number((openingBalance + cashSales - expenseAmount).toFixed(2));
    const variance = daysAgo % 7 === 0 ? -100 : daysAgo % 11 === 0 ? 150 : 0;
    const openedAt = dateAt(day, 7, 30);
    const closedAt = dateAt(day, 20, 15);

    const dailyOps: Prisma.PrismaPromise<unknown>[] = [
      prisma.cashSession.create({
        data: {
          businessId: business.id,
          cashierId: cashier.id,
          openingBalance,
          expectedBalance,
          closingBalance: Number((expectedBalance + variance).toFixed(2)),
          variance,
          openedAt: toIso(openedAt),
          closedAt: toIso(closedAt),
        },
      }),
    ];

    if (hasExpense) {
      dailyOps.push(
        prisma.expense.create({
          data: {
            businessId: business.id,
            category: daysAgo % 10 === 0 ? "STOCK" : "UTILITIES",
            description:
              daysAgo % 10 === 0
                ? "Bulk replenishment of fast-moving shelf items"
                : "Electricity and water utility settlement",
            amount: Number(expenseAmount.toFixed(2)),
            paidTo: daysAgo % 10 === 0 ? supplier.name : "Local Utilities Provider",
            recordedBy: cashier.id,
            createdAt: toIso(dateAt(day, 18, 30)),
          },
        }),
      );
      expenseCount += 1;
    }

    await prisma.$transaction(dailyOps);
  }

  console.log(`Created tenant ${business.id}`);
  console.log(`Seeded ${productRecords.length} products, ${saleCount} sales, and ${expenseCount} expenses across 30 days.`);
  console.log("Owner login: owner@mobiduka.com / OwnerPass123");
  console.log("Cashier PINs: 2540 and 2541");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
