export const demoProducts = [
  ['Jogoo Maize Flour 2kg', 'JOG-2KG', '6191000000011', 145, 185, 18, 180],
  ['Maji ya Premium 500ml', 'MAJ-500', '6191000000028', 18, 30, 30, 300],
  ['Chapa Mandashi Baking Powder 100g', 'CHP-100', '6191000000035', 38, 55, 12, 100],
  ['Kabras Brown Sugar 1kg', 'KBR-1KG', '6191000000042', 118, 150, 15, 140],
  ['Fresh Fri Cooking Oil 1L', 'FFO-1L', '6191000000059', 245, 295, 10, 90],
  ['Brookside Milk 500ml', 'BRK-500', '6191000000066', 48, 65, 24, 220],
  ['Kuku Paka Salt 500g', 'KPS-500', '6191000000073', 28, 40, 18, 160],
  ['Blue Band Margarine 500g', 'BLB-500', '6191000000080', 155, 195, 10, 80],
  ['Nescafe Classic 50g', 'NES-050', '6191000000097', 170, 215, 8, 70],
  ['Omo Detergent 500g', 'OMO-500', '6191000000103', 105, 135, 10, 100],
  ['Geisha Bathing Soap 125g', 'GEI-125', '6191000000110', 52, 75, 20, 180],
  ['Colgate Toothpaste 100ml', 'COL-100', '6191000000127', 105, 145, 8, 70],
  ['Royco Beef Cubes 10s', 'ROY-010', '6191000000134', 42, 60, 15, 130],
  ['Soko Maize Meal 2kg', 'SOK-2KG', '6191000000141', 132, 175, 16, 150],
  ['Safaricom Airtime 100 KES', 'SAF-100', '6191000000158', 92, 100, 20, 250],
] as const

export const productDB: Record<string, { name: string; barcode: string; category: string; price: number; stock: number; supplier: string; emoji: string; status: string }> = {
  '6001068023227': { name: 'Unga Jogoo 2kg',   barcode: '6001068023227', category: 'Flour',    price: 200, stock: 45, supplier: 'Unga Limited',   emoji: '🌾', status: 'good'     },
  '6009876541230': { name: 'Milk 500ml',        barcode: '6009876541230', category: 'Dairy',    price: 100, stock: 60, supplier: 'Brookside Dairy', emoji: '🥛', status: 'good'     },
  '6001253001021': { name: 'Cooking Oil 1L',    barcode: '6001253001021', category: 'Oils',     price: 190, stock: 32, supplier: 'Bidco Africa',    emoji: '🫙', status: 'good'     },
  '6002200022220': { name: 'Panadol 500mg',     barcode: '6002200022220', category: 'Pharma',   price: 30,  stock: 3,  supplier: 'Dawa Limited',    emoji: '💊', status: 'critical' },
  '6005001234567': { name: 'Sugar 1kg',         barcode: '6005001234567', category: 'Sugar',    price: 140, stock: 28, supplier: 'Mumias Sugar',    emoji: '🍬', status: 'low'      },
  '6006543219876': { name: 'Royco 75g',         barcode: '6006543219876', category: 'Spices',   price: 45,  stock: 5,  supplier: 'Unilever Kenya',  emoji: '🌶️', status: 'critical' },
  '6007112233445': { name: 'Blue Band 500g',    barcode: '6007112233445', category: 'Spreads',  price: 150, stock: 18, supplier: 'Bidco Africa',    emoji: '🧈', status: 'low'      },
  '6008998877661': { name: 'Omo 400g',          barcode: '6008998877661', category: 'Detergent',price: 180, stock: 8,  supplier: 'P&G Kenya',       emoji: '🧺', status: 'low'      },
}

export const recentScans = [
  { name: 'Unga Jogoo 2kg',  barcode: '6001068023227', action: 'Added to cart',   time: '14:32', emoji: '🌾' },
  { name: 'Milk 500ml',      barcode: '6009876541230', action: 'Stock adjusted',  time: '14:18', emoji: '🥛' },
  { name: 'Cooking Oil 1L',  barcode: '6001253001021', action: 'Price checked',   time: '13:55', emoji: '🫙' },
]


export const creditCustomers = [
  { id: 1, name: 'James Kariuki',   phone: '0712 345 678', balance: 4200 },
  { id: 2, name: 'Mary Achieng',    phone: '0723 456 789', balance: 1800 },
  { id: 3, name: 'David Mutua',     phone: '0734 567 890', balance: 0    },
  { id: 4, name: 'Wanjiku Njoroge', phone: '0745 678 901', balance: 9500 },
  { id: 5, name: 'Hassan Juma',     phone: '0756 789 012', balance: 3300 },
  { id: 6, name: 'Grace Otieno',    phone: '0767 890 123', balance: 600  },
  { id: 7, name: 'Peter Ndirangu',  phone: '0778 901 234', balance: 0    },
  { id: 8, name: 'Faith Wambua',    phone: '0789 012 345', balance: 2150 },
]

export const products = [
  { id: 1, name: 'Unga Jogoo 2kg', price: 200, category: 'Flour', stock: 45, emoji: '🌾' },
  { id: 2, name: 'Cooking Oil 1L', price: 190, category: 'Oils', stock: 32, emoji: '🫙' },
  { id: 3, name: 'Sugar 1kg', price: 140, category: 'Sugar', stock: 28, emoji: '🍬' },
  { id: 4, name: 'Blue Band 500g', price: 150, category: 'Spreads', stock: 18, emoji: '🧈' },
  { id: 5, name: 'Milk 500ml', price: 100, category: 'Dairy', stock: 60, emoji: '🥛' },
  { id: 6, name: 'Royco 75g', price: 45, category: 'Spices', stock: 5, emoji: '🌶️' },
  { id: 7, name: 'Panadol 500mg', price: 30, category: 'Pharma', stock: 3, emoji: '💊' },
  { id: 8, name: 'Omo 400g', price: 180, category: 'Detergent', stock: 8, emoji: '🧺' },
  { id: 9, name: 'Colgate 100ml', price: 85, category: 'Personal', stock: 22, emoji: '🪥' },
  { id: 10, name: 'Bread White', price: 55, category: 'Bakery', stock: 15, emoji: '🍞' },
  { id: 11, name: 'Eggs (tray)', price: 480, category: 'Dairy', stock: 12, emoji: '🥚' },
  { id: 12, name: 'Nescafé 100g', price: 320, category: 'Beverages', stock: 9, emoji: '☕' },
]

export const categories = ['All', 'Flour', 'Oils', 'Sugar', 'Dairy', 'Pharma', 'Beverages', 'Spreads', 'Spices', 'Bakery']
