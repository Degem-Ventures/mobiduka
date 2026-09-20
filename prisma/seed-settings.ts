import { prisma } from "../lib/prisma";

const defaults = {
  receiptPrint: true,
  lowStockAlerts: true,
  dailyReport: false,
  autoBackup: true,
  mpesaEnabled: true,
};

const reportGroups: Record<string, string> = {
  Flour: "Grains & Baking", Bakery: "Grains & Baking", Baking: "Grains & Baking", Sugar: "Grains & Baking",
  Dairy: "Fresh & Dairy", Water: "Fresh & Dairy", Oils: "Cooking & Spreads", Spreads: "Cooking & Spreads", Spices: "Cooking & Spreads",
  Pharma: "Care & Wellness", Cleaning: "Care & Wellness", Personal: "Care & Wellness",
  Beverages: "Drinks & Digital", Airtime: "Drinks & Digital",
};

async function main() {
  const businessId = process.env.DEMO_BUSINESS_ID?.trim();
  const businesses = await prisma.business.findMany({
    where: businessId ? { id: businessId } : undefined,
    select: { id: true },
  });

  for (const business of businesses) {
    const categories = await prisma.category.findMany({ where: { businessId: business.id }, select: { id: true, name: true } });
    for (const category of categories) {
      await prisma.category.update({ where: { id: category.id }, data: { reportGroup: reportGroups[category.name] ?? "Care & Wellness" } });
    }
    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...defaults },
      update: {},
    });
    if (businessId) {
      await prisma.business.update({
        where: { id: business.id },
        data: { kraPin: "A123456789B" },
      });
    }
  }

  console.log(`Seeded settings for ${businesses.length} business${businesses.length === 1 ? "" : "es"}.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
