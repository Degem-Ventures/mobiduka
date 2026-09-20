import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoSuppliers } from "../data/demo-suppliers";
import { demoPurchaseOrders } from "../data/demo-purchase-orders";
import { demoCustomers } from "../data/demo-customers";
import { demoNotifications } from "../data/demo-notifications";

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

const products = [
  ["Jogoo Maize Flour 2kg", "JOG-2KG", "6191000000011", 145, 185, 18, 180],
  ["Maji ya Premium 500ml", "MAJ-500", "6191000000028", 18, 30, 30, 300],
  ["Chapa Mandashi Baking Powder 100g", "CHP-100", "6191000000035", 38, 55, 12, 100],
  ["Kabras Brown Sugar 1kg", "KBR-1KG", "6191000000042", 118, 150, 15, 140],
  ["Fresh Fri Cooking Oil 1L", "FFO-1L", "6191000000059", 245, 295, 10, 90],
  ["Brookside Milk 500ml", "BRK-500", "6191000000066", 48, 65, 24, 220],
  ["Kuku Paka Salt 500g", "KPS-500", "6191000000073", 28, 40, 18, 160],
  ["Blue Band Margarine 500g", "BLB-500", "6191000000080", 155, 195, 10, 80],
  ["Nescafe Classic 50g", "NES-050", "6191000000097", 170, 215, 8, 70],
  ["Omo Detergent 500g", "OMO-500", "6191000000103", 105, 135, 10, 100],
  ["Geisha Bathing Soap 125g", "GEI-125", "6191000000110", 52, 75, 20, 180],
  ["Colgate Toothpaste 100ml", "COL-100", "6191000000127", 105, 145, 8, 70],
  ["Royco Beef Cubes 10s", "ROY-010", "6191000000134", 42, 60, 15, 130],
  ["Soko Maize Meal 2kg", "SOK-2KG", "6191000000141", 132, 175, 16, 150],
  ["Safaricom Airtime 100 KES", "SAF-100", "6191000000158", 92, 100, 20, 250],
] as const;

const categorySeeds = [
  ["Flour", "🌾"],
  ["Oils", "🫙"],
  ["Sugar", "🍬"],
  ["Dairy", "🥛"],
  ["Pharma", "💊"],
  ["Beverages", "☕"],
  ["Spreads", "🧈"],
  ["Spices", "🌶️"],
  ["Bakery", "🍞"],
  ["Water", "💧"],
  ["Baking", "🧁"],
  ["Cleaning", "🧺"],
  ["Personal", "🧼"],
  ["Airtime", "📱"],
] as const;

const productMetadata: Record<string, { category: string; emoji: string }> = {
  "JOG-2KG": { category: "Flour", emoji: "🌾" },
  "MAJ-500": { category: "Water", emoji: "💧" },
  "CHP-100": { category: "Baking", emoji: "🧁" },
  "KBR-1KG": { category: "Sugar", emoji: "🍬" },
  "FFO-1L": { category: "Oils", emoji: "🫙" },
  "BRK-500": { category: "Dairy", emoji: "🥛" },
  "KPS-500": { category: "Spices", emoji: "🧂" },
  "BLB-500": { category: "Spreads", emoji: "🧈" },
  "NES-050": { category: "Beverages", emoji: "☕" },
  "OMO-500": { category: "Cleaning", emoji: "🧺" },
  "GEI-125": { category: "Personal", emoji: "🧼" },
  "COL-100": { category: "Personal", emoji: "🪥" },
  "ROY-010": { category: "Spices", emoji: "🌶️" },
  "SOK-2KG": { category: "Flour", emoji: "🥣" },
  "SAF-100": { category: "Airtime", emoji: "📱" },
};

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
      name: "MobiDuka Wholesale",
      branch: "Eldoret Branch",
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
  const [owner, cashierOne, cashierTwo] = await prisma.$transaction([
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
  void owner;
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

  const supplierRecords = await prisma.$transaction(
    demoSuppliers.map((supplier) => prisma.supplier.create({ data: { businessId: business.id, ...supplier } })),
  );
  const supplierForCategory: Record<string, string> = {
    Flour: "Unga Limited",
    Oils: "Bidco Africa",
    Sugar: "Unga Limited",
    Dairy: "Brookside Dairy",
    Beverages: "Procter & Gamble",
    Spreads: "Bidco Africa",
    Spices: "Procter & Gamble",
    Water: "Brookside Dairy",
    Baking: "Unga Limited",
    Cleaning: "Procter & Gamble",
    Personal: "Procter & Gamble",
    Airtime: "Procter & Gamble",
  };
  const suppliersByName = new Map(supplierRecords.map((supplier) => [supplier.name, supplier]));
  const supplier = supplierRecords[0];

  const categoryRecords = await prisma.$transaction(
    categorySeeds.map(([name, emoji]) =>
      prisma.category.create({ data: { businessId: business.id, name, emoji } }),
    ),
  );
  const categoriesByName = new Map(categoryRecords.map((category) => [category.name, category]));

  const productRecords = await prisma.$transaction(
    products.map(([name, sku, barcode, costPrice, sellingPrice, minimumStock, stock]) => {
      const metadata = productMetadata[sku];
      const category = metadata ? categoriesByName.get(metadata.category) : undefined;
      if (!metadata || !category) throw new Error(`Missing seed metadata for product: ${sku}`);
      const supplierRecord = suppliersByName.get(supplierForCategory[metadata.category] ?? supplier.name) ?? supplier;
      return prisma.product.create({
        data: {
          businessId: business.id,
          categoryId: category.id,
          supplierId: supplierRecord.id,
          name,
          sku,
          barcode,
          emoji: metadata.emoji,
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
      });
    }),
  );

  const customerRecords = await prisma.$transaction(
    demoCustomers.map((customer) =>
      prisma.customer.create({
        data: {
          businessId: business.id,
          name: customer.name,
          phone: customer.phone,
          creditLimit: Math.max(customer.credit, customer.creditCharge),
          creditAccount: { create: { balance: customer.credit, status: customer.credit === 0 ? "CLEARED" : "ACTIVE" } },
        },
      }),
    ),
  );
  for (let index = 0; index < demoCustomers.length; index += 1) {
    const customer = demoCustomers[index];
    const record = customerRecords[index];
    await prisma.creditLedgerEntry.createMany({
      data: [
        { businessId: business.id, customerId: record.id, type: "CHARGE", amount: customer.creditCharge, status: "PENDING" },
        ...(customer.creditPayment > 0 ? [{ businessId: business.id, customerId: record.id, type: "PAYMENT", amount: customer.creditPayment, status: "COMPLETED" }] : []),
      ],
    });
  }

  const productsBySku = new Map(productRecords.map((product) => [product.sku, product]));
  for (const purchaseOrderSeed of demoPurchaseOrders) {
    const supplierRecord = suppliersByName.get(purchaseOrderSeed.supplier);
    if (!supplierRecord) throw new Error(`Missing purchase-order supplier: ${purchaseOrderSeed.supplier}`);
    const items = purchaseOrderSeed.items.map((item) => {
      const product = productsBySku.get(item.sku);
      if (!product) throw new Error(`Missing purchase-order product: ${item.sku}`);
      return { productId: product.id, quantity: item.quantity, costPrice: item.costPrice };
    });
    await prisma.purchaseOrder.create({
      data: {
        businessId: business.id,
        supplierId: supplierRecord.id,
        orderNo: purchaseOrderSeed.orderNo,
        status: purchaseOrderSeed.status,
        totalCost: items.reduce((total, item) => total + item.quantity * item.costPrice, 0),
        dueDate: new Date(`${purchaseOrderSeed.dueDate}T00:00:00.000Z`),
        items: { create: items },
      },
    });
  }

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
    const salesCount = 3 + (daysAgo % 6);
    const saleRows: Array<{ total: number }> = [];
    const dailyBatch: Array<ReturnType<typeof prisma.sale.create>> = [];

    for (let saleIndex = 0; saleIndex < salesCount; saleIndex += 1) {
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
            customerId: customerRecords[(daysAgo + saleIndex) % customerRecords.length].id,
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

    const cashSales = Number((saleRows.reduce((sum, sale) => sum + sale.total, 0) * 0.66).toFixed(2));
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

  await prisma.notification.createMany({
    data: demoNotifications.map(notification => ({
      businessId: business.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    })),
  });

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
