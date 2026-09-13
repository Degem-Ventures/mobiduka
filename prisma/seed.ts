import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding script...");

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
  await prisma.customer.deleteMany({});
  await prisma.creditAccount.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.cashSession.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.license.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.business.deleteMany({});
  await prisma.role.deleteMany({});

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
  console.log(`🏢 Created Business Tenant ID: ${business.id}`);

  const device = await prisma.device.create({
    data: {
      id: "f9fe7e90-cff9-4e99-8335-d33eea68a8ec",
      businessId: business.id,
      deviceUuid: "flutter-pos-hardware-token-12345",
      deviceName: "Main Counter Tablet (X3)",
      deviceModel: "Android Tablet",
      platform: "android",
      status: "ACTIVE",
    },
  });
  console.log(`📱 Registered Hardware Device Profile: ${device.deviceName}`);

  const ownerRole = await prisma.role.upsert({
    where: { name: "OWNER" },
    update: {},
    create: { name: "OWNER", description: "Store owner" },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: "CASHIER" },
    update: {},
    create: { name: "CASHIER", description: "Shift cashier" },
  });

  const supplier = await prisma.supplier.create({
    data: {
      id: "d5ff2b9c-f5a1-49d4-bf9a-c3c2d7ef051d",
      businessId: business.id,
      name: "MobiDuka Distribution Hub",
      phone: "+254700112233",
      email: "supplies@mobiduka.com",
      location: "Nairobi",
      contactPerson: "Grace Achieng",
      notes: "Primary wholesale supplier for seed inventory",
    },
  });
  console.log(`🏪 Created Supplier Profile: ${supplier.name} (${supplier.id})`);

  const ownerPasswordHash = await bcrypt.hash("OwnerPass123", 10);
  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      email: "owner@mobiduka.com",
      fullName: "John Kamau",
      roleId: ownerRole.id,
      passwordHash: ownerPasswordHash,
      status: "ACTIVE",
    },
  });
  console.log(`🔐 Created Admin Owner Account: ${owner.email}`);

  const cashier = await prisma.user.create({
    data: {
      businessId: business.id,
      email: "cashier1@mobiduka.com",
      username: "cashier1",
      fullName: "Faith Mutua",
      roleId: cashierRole.id,
      pinHash: await bcrypt.hash("2540", 10),
      status: "ACTIVE",
    },
  });
  console.log(`🔢 Created Shift Cashier Profile: ${cashier.fullName} (PIN: 2540)`);

  const items = [
    { name: "Safaricom Airtime 100 KES", sku: "SAF-100", barcode: "6001234567891", sellingPrice: 100.0, costPrice: 92.0, minimumStock: 10, stock: 150 },
    { name: "Taifa Maize Flour 2KG", sku: "TFA-2KG", barcode: "6191234567812", sellingPrice: 190.0, costPrice: 165.0, minimumStock: 12, stock: 85 },
    { name: "Kasuku Cooking Oil 1L", sku: "KAS-1L", barcode: "6198765432109", sellingPrice: 320.0, costPrice: 285.0, minimumStock: 8, stock: 40 },
  ];

  for (const item of items) {
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice,
        minimumStock: item.minimumStock,
        trackStock: true,
        status: "ACTIVE",
        syncStatus: "SYNCED",
      },
    });

    await prisma.inventory.create({
      data: {
        businessId: business.id,
        productId: product.id,
        quantity: item.stock,
        reservedQuantity: 0,
      },
    });
  }

  console.log("📦 Seeded baseline inventory catalogue products successfully!");
  console.log("🏁 Database seeding execution complete.");
}

main()
  .catch((error) => {
    console.error("❌ Seeding execution exception thrown:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
