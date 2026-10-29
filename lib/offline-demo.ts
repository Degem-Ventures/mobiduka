import { isNativeOfflineApp, writeOfflineCollection } from "./offline-store"

export const offlineDemoBusinessId = "mobiduka-offline-demo-v1"
export const offlineDemoCashierId = "mobiduka-offline-demo-cashier"
export const offlineDemoShiftId = "mobiduka-offline-demo-shift"
export const offlineDemoBusinessName = "MobiDuka Sample Store"

const demoProducts = [
  {
    id: "demo-product-maize-flour",
    name: "Maize Flour 2kg",
    emoji: "🌽",
    barcode: "DEMO1001",
    sellingPrice: 180,
    recentUnitsSold: 8,
    category: { id: "demo-category-groceries", name: "Groceries", emoji: "🛒" },
    inventory: { quantity: 24 },
  },
  {
    id: "demo-product-milk",
    name: "Fresh Milk 500ml",
    emoji: "🥛",
    barcode: "DEMO1002",
    sellingPrice: 65,
    recentUnitsSold: 12,
    category: { id: "demo-category-dairy", name: "Dairy", emoji: "🥛" },
    inventory: { quantity: 30 },
  },
  {
    id: "demo-product-bread",
    name: "White Bread",
    emoji: "🍞",
    barcode: "DEMO1003",
    sellingPrice: 70,
    recentUnitsSold: 6,
    category: { id: "demo-category-bakery", name: "Bakery", emoji: "🍞" },
    inventory: { quantity: 18 },
  },
  {
    id: "demo-product-cooking-oil",
    name: "Cooking Oil 1L",
    emoji: "🫗",
    barcode: "DEMO1004",
    sellingPrice: 320,
    recentUnitsSold: 4,
    category: { id: "demo-category-groceries", name: "Groceries", emoji: "🛒" },
    inventory: { quantity: 12 },
  },
]

const demoCategories = [
  { id: "demo-category-groceries", name: "Groceries", emoji: "🛒" },
  { id: "demo-category-dairy", name: "Dairy", emoji: "🥛" },
  { id: "demo-category-bakery", name: "Bakery", emoji: "🍞" },
]

export async function prepareOfflineDemo() {
  if (!isNativeOfflineApp()) {
    throw new Error("The offline demo is available in the Android and iOS apps.")
  }

  const openedAt = new Date().toISOString()
  const operators = [{
    id: offlineDemoCashierId,
    sessionId: offlineDemoShiftId,
    name: "Sample Cashier",
    shift: "Demo Shift",
    openedAt,
  }]
  const shiftSessions = [{
    id: offlineDemoShiftId,
    openedAt,
    closedAt: null,
    shiftType: "Demo Shift",
    cashier: {
      id: offlineDemoCashierId,
      fullName: "Sample Cashier",
      status: "ACTIVE",
      role: { name: "CASHIER" },
    },
    shift: { name: "Demo Shift" },
  }]

  await Promise.all([
    writeOfflineCollection(offlineDemoBusinessId, "pos.products.v1", demoProducts),
    writeOfflineCollection(offlineDemoBusinessId, "inventory.products.v1", demoProducts),
    writeOfflineCollection(offlineDemoBusinessId, "pos.categories.v1", demoCategories),
    writeOfflineCollection(offlineDemoBusinessId, "pos.customers.v1", []),
    writeOfflineCollection(offlineDemoBusinessId, "pos.shift_roster.v1", operators),
    writeOfflineCollection(offlineDemoBusinessId, "shifts.active-summary.v1", {
      sessions: shiftSessions,
    }),
  ])
  window.localStorage.setItem(
    `mobiduka.shift_roster.v1:${offlineDemoBusinessId}`,
    JSON.stringify(operators),
  )
  window.localStorage.setItem(
    `mobiduka.current_shift.v1:${offlineDemoBusinessId}`,
    offlineDemoShiftId,
  )
}
