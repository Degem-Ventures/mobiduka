import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { demoExpenses } from "../data/demo-expenses"
import { lifecareProducts } from "../data/lifecare-products"

const databaseUrl = (process.env.DATABASE_URL ?? "").trim()
const nodeEnv = (process.env.NODE_ENV ?? "").trim()
const forceSeed = process.argv.includes("--force-seed-lifecare")
const isProductionLikeDatabase =
  /(neon|postgres|prod|production|merchant|live)/i.test(databaseUrl) ||
  nodeEnv === "production"

if (isProductionLikeDatabase && !forceSeed) {
  console.error(
    "SEED ABORTED: production-like database detected. Re-run with --force-seed-lifecare for a controlled seed.",
  )
  process.exit(1)
}

const prisma = new PrismaClient()

const reportGroups: Record<string, string> = {
  Bakery: "Food & Drinks",
  Food: "Food & Drinks",
  Fruits: "Food & Drinks",
  Groceries: "Food & Drinks",
  "Hot Drinks": "Food & Drinks",
  Juice: "Food & Drinks",
  Milk: "Food & Drinks",
  Snacks: "Food & Drinks",
  "Snacks/Sweets": "Food & Drinks",
  "Soft Drinks": "Food & Drinks",
  Sweets: "Food & Drinks",
  Water: "Food & Drinks",
  Yoghurt: "Food & Drinks",
  "Energy Drinks": "Food & Drinks",
  Clothing: "Personal & Household",
  "Baby Care": "Personal & Household",
  Household: "Personal & Household",
  "Personal Care": "Personal & Household",
}

async function deleteTenantData(businessId: string) {
  await prisma.$transaction(async (transaction) => {
    await transaction.syncQueue.deleteMany({ where: { businessId } })
    await transaction.mpesaTransaction.deleteMany({ where: { businessId } })
    await transaction.auditLog.deleteMany({ where: { businessId } })
    await transaction.notification.deleteMany({ where: { businessId } })
    await transaction.payment.deleteMany({ where: { sale: { businessId } } })
    await transaction.saleItem.deleteMany({ where: { sale: { businessId } } })
    await transaction.sale.deleteMany({ where: { businessId } })
    await transaction.purchaseItem.deleteMany({
      where: { purchaseOrder: { businessId } },
    })
    await transaction.purchaseOrder.deleteMany({ where: { businessId } })
    await transaction.stockMovement.deleteMany({
      where: { product: { businessId } },
    })
    await transaction.inventory.deleteMany({ where: { businessId } })
    await transaction.product.deleteMany({ where: { businessId } })
    await transaction.creditLedgerEntry.deleteMany({ where: { businessId } })
    await transaction.creditAccount.deleteMany({
      where: { customer: { businessId } },
    })
    await transaction.customer.deleteMany({ where: { businessId } })
    await transaction.expense.deleteMany({ where: { businessId } })
    await transaction.cashSession.deleteMany({ where: { businessId } })
    await transaction.device.deleteMany({ where: { businessId } })
    await transaction.user.deleteMany({ where: { businessId } })
    await transaction.supplier.deleteMany({ where: { businessId } })
    await transaction.license.deleteMany({ where: { businessId } })
    await transaction.category.deleteMany({ where: { businessId } })
    await transaction.businessSettings.deleteMany({ where: { businessId } })
    await transaction.shiftType.deleteMany({ where: { businessId } })
  }, { maxWait: 15_000, timeout: 60_000 })
}

async function main() {
  let business = await prisma.business.findFirst({
    where: { name: "Lifecare Canteen", branch: "Eldoret Branch" },
  })
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: "Lifecare Canteen",
        branch: "Eldoret Branch",
        businessType: "canteen",
        ownerName: "Naomi Serem",
        phone: "0722992325",
        email: "naomi@lifecarecanteen.co.ke",
        country: "Kenya",
        currency: "KES",
        timezone: "Africa/Nairobi",
        subscriptionPlan: "starter",
        status: "ACTIVE",
      },
    })
  } else {
    business = await prisma.business.update({
      where: { id: business.id },
      data: {
        ownerName: "Naomi Serem",
        phone: "0722992325",
        email: "naomi@lifecarecanteen.co.ke",
        businessType: "canteen",
        status: "ACTIVE",
      },
    })
  }

  await deleteTenantData(business.id)
  await prisma.businessSettings.create({
    data: {
      businessId: business.id,
      receiptPrint: true,
      lowStockAlerts: true,
      dailyReport: true,
      autoBackup: true,
      mpesaEnabled: true,
    },
  })

  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: "OWNER" },
      update: { description: "Store owner and manager" },
      create: { name: "OWNER", description: "Store owner and manager" },
    }),
    prisma.role.upsert({
      where: { name: "CASHIER" },
      update: { description: "Canteen cashier" },
      create: { name: "CASHIER", description: "Canteen cashier" },
    }),
    prisma.role.upsert({
      where: { name: "SUPERVISOR" },
      update: { description: "Canteen supervisor" },
      create: { name: "SUPERVISOR", description: "Canteen supervisor" },
    }),
  ])
  const roleByName = new Map(roles.map((role) => [role.name, role]))
  const users = [
    {
      email: "naomi@lifecarecanteen.co.ke",
      fullName: "Naomi Serem",
      phone: "0722992325",
      role: "OWNER",
      password: "Lifecare@2026",
      shift: "Morning",
    },
    {
      email: "camilah@lifecarecanteen.co.ke",
      fullName: "Camilah Juddy",
      phone: "0701182237",
      role: "CASHIER",
      pin: "4826",
      shift: "Morning",
    },
    {
      email: "daniel.kip@lifecarecanteen.co.ke",
      fullName: "Daniel Kip",
      phone: "0700000000",
      role: "CASHIER",
      pin: "7391",
      shift: "Night",
    },
    {
      email: "steve@lifecarecanteen.co.ke",
      fullName: "Steve Kimutai",
      phone: "0721465246",
      role: "SUPERVISOR",
      password: "Steve@2026",
      shift: "Day",
    },
  ]
  for (const user of users) {
    await prisma.user.create({
      data: {
        businessId: business.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        roleId: roleByName.get(user.role)?.id,
        passwordHash: user.password
          ? await bcrypt.hash(user.password, 10)
          : undefined,
        pinHash: user.pin ? await bcrypt.hash(user.pin, 10) : undefined,
        shift: user.shift,
        status: "ACTIVE",
      },
    })
  }

  await prisma.shiftType.createMany({
    data: [
      {
        businessId: business.id,
        code: "morning",
        name: "Morning",
        scheduledStart: "06:00",
        scheduledEnd: "14:00",
        icon: "🌅",
        color: "#F57C00",
      },
      {
        businessId: business.id,
        code: "afternoon",
        name: "Afternoon",
        scheduledStart: "14:00",
        scheduledEnd: "22:00",
        icon: "☀️",
        color: "#0288D1",
      },
      {
        businessId: business.id,
        code: "night",
        name: "Night",
        scheduledStart: "22:00",
        scheduledEnd: "06:00",
        icon: "🌙",
        color: "#5E35B1",
      },
    ],
  })

  const categoryNames = [
    ...new Set(lifecareProducts.map((product) => product.category)),
  ]
  const categories = await prisma.$transaction(
    categoryNames.map((name) =>
      prisma.category.create({
        data: {
          businessId: business.id,
          name,
          reportGroup: reportGroups[name] ?? "Other",
          emoji: lifecareProducts.find((product) => product.category === name)
            ?.emoji,
        },
      }),
    ),
  )
  const categoriesByName = new Map(
    categories.map((category) => [category.name, category]),
  )
  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Lifecare Canteen Main Supplier",
      category: "General Stock",
      phone: "0700000001",
      location: "Eldoret",
    },
  })

  await prisma.$transaction(
    lifecareProducts.map((product) =>
      prisma.product.create({
        data: {
          businessId: business.id,
          categoryId: categoriesByName.get(product.category)?.id,
          supplierId: supplier.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          minimumStock: product.reorderLevel,
          vatRate: product.vatRate,
          barcode: product.barcode,
          emoji: product.emoji,
          trackStock: true,
          status: "ACTIVE",
          syncStatus: "SYNCED",
          inventory: {
            create: {
              businessId: business.id,
              quantity: product.openingStock,
              reservedQuantity: 0,
            },
          },
        },
      }),
    ),
  )

  await prisma.expense.createMany({
    data: demoExpenses.map((expense) => ({
      businessId: business.id,
      description: expense.description,
      category: expense.category,
      amount: 0,
      paymentMethod: expense.paymentMethod,
      icon: expense.icon,
      recurring: expense.recurring,
      createdAt: new Date(expense.date),
    })),
  })
  console.log(
    `Seeded Lifecare Canteen (${business.id}) with ${lifecareProducts.length} products and ${demoExpenses.length} zero-value expenses.`,
  )
  console.log("Owner login: naomi@lifecarecanteen.co.ke / Lifecare@2026")
  console.log("Camilah PIN: 4826 | Daniel PIN: 7391")
  console.log("Supervisor login: steve@lifecarecanteen.co.ke / Steve@2026")
}

main()
  .catch((error) => {
    console.error("Lifecare seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
