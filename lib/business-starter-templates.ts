export type BusinessStarterProduct = {
  name: string
  category: string
  unit: string
  emoji: string
}

export type BusinessStarterCategory = {
  name: string
  emoji: string
  reportGroup: string
}

export type BusinessStarterTemplate = {
  label: string
  categories: BusinessStarterCategory[]
  products: BusinessStarterProduct[]
}

const standardRetailTemplate: BusinessStarterTemplate = {
  label: "General retail",
  categories: [
    { name: "Groceries", emoji: "🛒", reportGroup: "Food & Groceries" },
    { name: "Beverages", emoji: "🥤", reportGroup: "Food & Groceries" },
    { name: "Household", emoji: "🧹", reportGroup: "Household" },
    { name: "Personal Care", emoji: "🧴", reportGroup: "Care & Wellness" },
  ],
  products: [
    {
      name: "Maize flour 2kg",
      category: "Groceries",
      unit: "packet",
      emoji: "🌽",
    },
    {
      name: "Cooking oil 1L",
      category: "Groceries",
      unit: "bottle",
      emoji: "🫗",
    },
    { name: "Sugar 1kg", category: "Groceries", unit: "packet", emoji: "🛍️" },
    {
      name: "Bottled water 500ml",
      category: "Beverages",
      unit: "bottle",
      emoji: "💧",
    },
    { name: "Laundry soap", category: "Household", unit: "piece", emoji: "🧼" },
    {
      name: "Bathing soap",
      category: "Personal Care",
      unit: "piece",
      emoji: "🧴",
    },
  ],
}

const businessStarterTemplates: Record<string, BusinessStarterTemplate> = {
  duka: { ...standardRetailTemplate, label: "Duka" },
  kiosk: {
    label: "Kiosk",
    categories: [
      { name: "Snacks", emoji: "🍪", reportGroup: "Food & Groceries" },
      { name: "Beverages", emoji: "🥤", reportGroup: "Food & Groceries" },
      { name: "Essentials", emoji: "🛒", reportGroup: "Household" },
    ],
    products: [
      {
        name: "Bottled water 500ml",
        category: "Beverages",
        unit: "bottle",
        emoji: "💧",
      },
      {
        name: "Soft drink 300ml",
        category: "Beverages",
        unit: "bottle",
        emoji: "🥤",
      },
      { name: "Biscuits", category: "Snacks", unit: "packet", emoji: "🍪" },
      { name: "Crisps", category: "Snacks", unit: "packet", emoji: "🍟" },
      {
        name: "Tissue paper",
        category: "Essentials",
        unit: "pack",
        emoji: "🧻",
      },
    ],
  },
  "mini-shop": {
    ...standardRetailTemplate,
    label: "Mini-shop",
    categories: [
      ...standardRetailTemplate.categories,
      { name: "Home & Kitchen", emoji: "🍽️", reportGroup: "Household" },
    ],
    products: [
      ...standardRetailTemplate.products,
      {
        name: "Food storage container",
        category: "Home & Kitchen",
        unit: "piece",
        emoji: "🥣",
      },
    ],
  },
  "mini-market": {
    ...standardRetailTemplate,
    label: "Mini-market",
    categories: [
      ...standardRetailTemplate.categories,
      { name: "Home & Kitchen", emoji: "🍽️", reportGroup: "Household" },
    ],
    products: [
      ...standardRetailTemplate.products,
      {
        name: "Food storage container",
        category: "Home & Kitchen",
        unit: "piece",
        emoji: "🥣",
      },
    ],
  },
  pharmacy: {
    label: "Pharmacy",
    categories: [
      {
        name: "Prescription Items",
        emoji: "💊",
        reportGroup: "Care & Wellness",
      },
      { name: "Over-the-Counter", emoji: "🩹", reportGroup: "Care & Wellness" },
      { name: "Medical Supplies", emoji: "🩺", reportGroup: "Care & Wellness" },
      { name: "Personal Care", emoji: "🧴", reportGroup: "Care & Wellness" },
    ],
    products: [
      {
        name: "Prescription item - enter approved details",
        category: "Prescription Items",
        unit: "pack",
        emoji: "💊",
      },
      {
        name: "OTC item - enter approved details",
        category: "Over-the-Counter",
        unit: "pack",
        emoji: "🩹",
      },
      {
        name: "First-aid supply - enter details",
        category: "Medical Supplies",
        unit: "piece",
        emoji: "🩺",
      },
      {
        name: "Personal-care item - enter details",
        category: "Personal Care",
        unit: "piece",
        emoji: "🧴",
      },
    ],
  },
  agrovet: {
    label: "Agrovet",
    categories: [
      { name: "Seeds & Planting", emoji: "🌱", reportGroup: "Farm Supplies" },
      { name: "Animal Care", emoji: "🐄", reportGroup: "Farm Supplies" },
      { name: "Crop Care", emoji: "🌿", reportGroup: "Farm Supplies" },
      { name: "Farm Tools", emoji: "🧰", reportGroup: "Farm Supplies" },
    ],
    products: [
      {
        name: "Seed item - enter crop and pack details",
        category: "Seeds & Planting",
        unit: "packet",
        emoji: "🌱",
      },
      {
        name: "Animal-care item - enter approved details",
        category: "Animal Care",
        unit: "pack",
        emoji: "🐄",
      },
      {
        name: "Crop-care item - enter approved details",
        category: "Crop Care",
        unit: "pack",
        emoji: "🌿",
      },
      {
        name: "Farm tool - enter details",
        category: "Farm Tools",
        unit: "piece",
        emoji: "🧰",
      },
    ],
  },
  "retail-chain": {
    ...standardRetailTemplate,
    label: "Growing multi-branch retailer",
    categories: [
      ...standardRetailTemplate.categories,
      { name: "Home & Kitchen", emoji: "🍽️", reportGroup: "Household" },
      {
        name: "Electronics & Accessories",
        emoji: "🔌",
        reportGroup: "Electronics",
      },
    ],
    products: [
      ...standardRetailTemplate.products,
      {
        name: "Food storage container",
        category: "Home & Kitchen",
        unit: "piece",
        emoji: "🥣",
      },
      {
        name: "Charging cable",
        category: "Electronics & Accessories",
        unit: "piece",
        emoji: "🔌",
      },
    ],
  },
}

const otherTemplate: BusinessStarterTemplate = {
  label: "Other business",
  categories: [
    { name: "General Items", emoji: "📦", reportGroup: "Other" },
    { name: "Services", emoji: "🧾", reportGroup: "Other" },
  ],
  products: [
    {
      name: "General item - replace with your product",
      category: "General Items",
      unit: "piece",
      emoji: "📦",
    },
    {
      name: "Service - replace with your service",
      category: "Services",
      unit: "service",
      emoji: "🧾",
    },
  ],
}

export function getBusinessStarterTemplate(
  businessType: string | null | undefined,
): BusinessStarterTemplate | null {
  if (!businessType) return null
  const key = businessType.trim().toLowerCase()
  return (
    businessStarterTemplates[key] ?? (key === "other" ? otherTemplate : null)
  )
}
