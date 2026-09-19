export type DemoEmployeeRole = 'Store Manager' | 'Cashier' | 'Stock Keeper' | 'Supervisor' | 'Accountant'

export const demoEmployees = [
  { id: 1, name: 'Admin User', role: 'Store Manager' as DemoEmployeeRole, phone: '0712 345 678', email: 'admin@mobiduka.co.ke', pin: '1234', shift: 'Morning', salary: 55000, startDate: '1 Jan 2024', active: true, initials: 'AU', color: '#123A8F' },
  { id: 2, name: 'Kevin Ochieng', role: 'Cashier' as DemoEmployeeRole, phone: '0723 456 789', email: 'kevin@mobiduka.co.ke', pin: '2345', shift: 'Morning', salary: 28000, startDate: '15 Mar 2024', active: true, initials: 'KO', color: '#2E7D32' },
  { id: 3, name: 'Fatuma Hassan', role: 'Stock Keeper' as DemoEmployeeRole, phone: '0734 567 890', email: 'fatuma@mobiduka.co.ke', pin: '3456', shift: 'Afternoon', salary: 30000, startDate: '1 Jun 2024', active: true, initials: 'FH', color: '#D32F2F' },
  { id: 4, name: 'Brian Mutua', role: 'Cashier' as DemoEmployeeRole, phone: '0745 678 901', email: 'brian@mobiduka.co.ke', pin: '4567', shift: 'Evening', salary: 26000, startDate: '20 Aug 2024', active: false, initials: 'BM', color: '#F57C00' },
  { id: 5, name: 'Linda Auma', role: 'Supervisor' as DemoEmployeeRole, phone: '0756 789 012', email: 'linda@mobiduka.co.ke', pin: '5678', shift: 'Morning', salary: 38000, startDate: '10 Feb 2025', active: true, initials: 'LA', color: '#7B1FA2' },
  { id: 6, name: 'Grace Wanjiku', role: 'Cashier' as DemoEmployeeRole, phone: '0767 890 123', email: 'grace@mobiduka.co.ke', pin: '6789', shift: 'Morning', salary: 28000, startDate: '1 Mar 2025', active: true, initials: 'GW', color: '#2E7D32' },
  { id: 7, name: 'Brian Omondi', role: 'Cashier' as DemoEmployeeRole, phone: '0778 901 234', email: 'brian.omondi@mobiduka.co.ke', pin: '7890', shift: 'Afternoon', salary: 28000, startDate: '1 Apr 2025', active: true, initials: 'BO', color: '#0288D1' },
  { id: 8, name: 'Peter Kamau', role: 'Cashier' as DemoEmployeeRole, phone: '0789 012 345', email: 'peter.kamau@mobiduka.co.ke', pin: '8901', shift: 'Afternoon', salary: 28000, startDate: '1 May 2025', active: true, initials: 'PK', color: '#2E7D32' },
  { id: 9, name: 'Aisha Mwangi', role: 'Cashier' as DemoEmployeeRole, phone: '0790 123 456', email: 'aisha.mwangi@mobiduka.co.ke', pin: '9012', shift: 'Night', salary: 30000, startDate: '1 Jun 2025', active: true, initials: 'AM', color: '#5E35B1' },
] as const

export const demoShiftHistory = [
  { employeeName: 'Grace Wanjiku', shiftType: 'morning', start: '2026-09-19T06:02:00.000Z', end: '2026-09-19T14:05:00.000Z', sales: 34, amount: 28400 },
  { employeeName: 'Brian Omondi', shiftType: 'afternoon', start: '2026-09-19T14:00:00.000Z', end: '2026-09-19T21:58:00.000Z', sales: 21, amount: 19750 },
  { employeeName: 'Fatuma Hassan', shiftType: 'morning', start: '2026-09-18T06:00:00.000Z', end: '2026-09-18T14:00:00.000Z', sales: 41, amount: 35200 },
  { employeeName: 'Peter Kamau', shiftType: 'afternoon', start: '2026-09-18T14:00:00.000Z', end: '2026-09-18T21:55:00.000Z', sales: 18, amount: 14800 },
  { employeeName: 'Aisha Mwangi', shiftType: 'night', start: '2026-09-07T22:00:00.000Z', end: '2026-09-08T06:02:00.000Z', sales: 9, amount: 7300 },
] as const

export const demoShiftTypes = [
  { code: 'morning', name: 'Morning', scheduledStart: '06:00', scheduledEnd: '14:00', icon: '🌅', color: '#F57C00' },
  { code: 'afternoon', name: 'Afternoon', scheduledStart: '14:00', scheduledEnd: '22:00', icon: '☀️', color: '#0288D1' },
  { code: 'night', name: 'Night', scheduledStart: '22:00', scheduledEnd: '06:00', icon: '🌙', color: '#5E35B1' },
] as const