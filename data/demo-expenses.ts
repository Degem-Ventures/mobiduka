export const demoExpenses = [
  { description: 'Electricity Bill', category: 'Utilities', amount: 8500, date: '2026-07-08', paymentMethod: 'M-Pesa', icon: '⚡', recurring: true },
  { description: 'Staff Salaries', category: 'Payroll', amount: 75000, date: '2026-07-07', paymentMethod: 'Bank', icon: '👥', recurring: true },
  { description: 'Shop Rent', category: 'Rent', amount: 35000, date: '2026-07-01', paymentMethod: 'Bank', icon: '🏪', recurring: true },
  { description: 'Plastic Bags & Packaging', category: 'Supplies', amount: 2300, date: '2026-07-06', paymentMethod: 'Cash', icon: '🛍️', recurring: false },
  { description: 'Internet & Data', category: 'Utilities', amount: 3500, date: '2026-07-05', paymentMethod: 'M-Pesa', icon: '📶', recurring: true },
  { description: 'Cleaning Supplies', category: 'Supplies', amount: 1200, date: '2026-07-04', paymentMethod: 'Cash', icon: '🧹', recurring: false },
  { description: 'Transport / Delivery', category: 'Logistics', amount: 4500, date: '2026-07-03', paymentMethod: 'Cash', icon: '🚚', recurring: false },
  { description: 'NHIF Deductions', category: 'Payroll', amount: 6400, date: '2026-07-01', paymentMethod: 'Bank', icon: '🏥', recurring: true },
] as const