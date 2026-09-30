import { prisma } from "../lib/prisma";

const defaults = {
  receiptPrint: true,
  lowStockAlerts: true,
  dailyReport: false,
  autoBackup: true,
  mpesaEnabled: true,
  receiptConfig: {
    headerText: "Thank you for shopping with us!",
    footerText: "Goods sold are not refundable · Valid receipt required for exchange",
    format: "80mm",
    showLogo: true,
    showTax: true,
    showDiscount: true,
    showCashier: true,
    showShift: true,
    showBarcode: false,
    receiptPrefix: "RCP",
    nextNumber: "1042",
  },
  taxConfig: {
    vatEnabled: true,
    defaultRate: "standard",
    filingPeriod: "Monthly",
    etimsEnabled: false,
    etimsDevice: "",
  },
  paymentConfig: {
    methods: { cash: true, mpesa: true, bank: false, card: false, credit: true },
    mpesaConfig: { type: "till", till: "", paybill: "", account: "" },
    bankConfig: { name: "", account: "", branch: "" },
    roundCash: false,
    creditLimit: "5000",
    requireApproval: true,
  },
};

async function main() {
  const businessId = process.env.DEMO_BUSINESS_ID?.trim();
  const businesses = await prisma.business.findMany({
    where: businessId ? { id: businessId } : undefined,
    select: { id: true },
  });

  for (const business of businesses) {
    const settings = await prisma.businessSettings.findUnique({ where: { businessId: business.id }, select: { taxConfig: true, paymentConfig: true } });
    if (!settings) {
      await prisma.businessSettings.create({ data: { businessId: business.id, ...defaults } });
    } else if (!settings.taxConfig || !settings.paymentConfig) {
      await prisma.businessSettings.update({ where: { businessId: business.id }, data: { ...(settings.taxConfig ? {} : { taxConfig: defaults.taxConfig }), ...(settings.paymentConfig ? {} : { paymentConfig: defaults.paymentConfig }) } });
    }
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
