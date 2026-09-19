export const demoPurchaseOrders = [
  {
    orderNo: 'PO-2026-084',
    supplier: 'Unga Limited',
    dueDate: '2026-07-10',
    status: 'REQUESTED',
    items: [
      { sku: 'JOG-2KG', quantity: 50, costPrice: 160 },
      { sku: 'SOK-2KG', quantity: 40, costPrice: 145 },
      { sku: 'CHP-100', quantity: 60, costPrice: 38 },
    ],
  },
  {
    orderNo: 'PO-2026-083',
    supplier: 'Bidco Africa',
    dueDate: '2026-07-09',
    status: 'RECEIVED',
    items: [
      { sku: 'FFO-1L', quantity: 40, costPrice: 245 },
      { sku: 'BLB-500', quantity: 30, costPrice: 155 },
    ],
  },
  {
    orderNo: 'PO-2026-082',
    supplier: 'Procter & Gamble',
    dueDate: '2026-07-07',
    status: 'PARTIAL',
    items: [
      { sku: 'OMO-500', quantity: 50, costPrice: 105 },
      { sku: 'GEI-125', quantity: 70, costPrice: 52 },
      { sku: 'COL-100', quantity: 45, costPrice: 105 },
    ],
  },
  {
    orderNo: 'PO-2026-081',
    supplier: 'Brookside Dairy',
    dueDate: '2026-07-05',
    status: 'RECEIVED',
    items: [
      { sku: 'BRK-500', quantity: 100, costPrice: 48 },
      { sku: 'MAJ-500', quantity: 120, costPrice: 18 },
    ],
  },
  {
    orderNo: 'PO-2026-080',
    supplier: 'Dawa Limited',
    dueDate: '2026-07-03',
    status: 'CANCELLED',
    items: [
      { sku: 'ROY-010', quantity: 80, costPrice: 42 },
    ],
  },
] as const