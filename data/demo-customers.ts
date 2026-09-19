export const demoCustomers = [
  { name: 'Jane Mwangi', phone: '0712 345 678', credit: 3400, creditCharge: 5000, creditPayment: 1600 },
  { name: 'Peter Otieno', phone: '0723 456 789', credit: 5200, creditCharge: 7000, creditPayment: 1800 },
  { name: 'Mary Wanjiku', phone: '0734 567 890', credit: 0, creditCharge: 2200, creditPayment: 2200 },
  { name: 'James Kariuki', phone: '0745 678 901', credit: 1800, creditCharge: 3000, creditPayment: 1200 },
  { name: 'Grace Achieng', phone: '0756 789 012', credit: 9600, creditCharge: 12000, creditPayment: 2400 },
  { name: 'David Kamau', phone: '0767 890 123', credit: 0, creditCharge: 1800, creditPayment: 1800 },
  { name: 'Sarah Njeri', phone: '0778 901 234', credit: 2100, creditCharge: 3500, creditPayment: 1400 },
] as const


export const txHistory = [
  { date: 'Today 14:18', type: 'Sale', amount: 3400, method: 'M-Pesa', items: 8 },
  { date: 'Yesterday', type: 'Credit', amount: 1200, method: 'Credit', items: 4 },
  { date: '5 Jul', type: 'Payment', amount: -2000, method: 'Cash', items: 0 },
  { date: '3 Jul', type: 'Sale', amount: 4800, method: 'Cash', items: 12 },
]
