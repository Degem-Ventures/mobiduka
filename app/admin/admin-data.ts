export type Tenant = {
  id: string
  business: string
  location: string
  owner: string
  email: string
  plan: string
  status: 'active' | 'trial' | 'suspended'
  cache: string
  mpesa: string
  type: 'Till' | 'Paybill'
  reference: string
  lastSync: string
}

export type UserRecord = {
  initials: string
  display: string
  legal: string
  id: string
  email: string
  role: string
  tenant: string
  sessions: number
  lastSeen: string
  status: string
}

export type LicenseRecord = {
  id: string
  tenant: string
  plan: string
  expires: string
  days: number
  renewal: boolean
  amount: number
  status: 'active' | 'grace' | 'revoked'
}

export type SyncConflict = {
  id: string
  tenant: string
  store: string
  profile: string
  description: string
  updated: string
}

export type ExpenseAudit = {
  id: string
  tenant: string
  category: string
  amount: number
  owner: string
  status: 'awaiting' | 'approved' | 'rejected'
}

export type ProcurementOrder = {
  id: string
  supplier: string
  tenant: string
  value: number
  progress: number
  eta: string
}

export const adminPageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/admin': { eyebrow: 'Platform pulse', title: 'Global Overview', description: 'Live operating health across every MobiDuka tenant.' },
  '/admin/infrastructure': { eyebrow: 'Engineering operations', title: 'System Infrastructure & Telemetry Node', description: 'Backend routes, reconciliation, workers, devices, and hidden ecosystem pipelines.' },
  '/admin/tenants': { eyebrow: 'Business registry', title: 'Tenants & Businesses', description: 'Manage storefronts, owners, gateways, and platform access.' },
  '/admin/identity': { eyebrow: 'Access control', title: 'Identity & Roles', description: 'Platform-wide users, sessions, and role assignments.' },
  '/admin/licenses': { eyebrow: 'Monetization', title: 'License Management', description: 'Plans, renewals, enforcement, and recurring revenue controls.' },
}

export const initialTenants: Tenant[] = [
  { id: 'TEN-KE-01842', business: 'MobiDuka Eldoret Branch', location: 'Eldoret, Uasin Gishu', owner: 'Diana Kiplagat', email: 'diana@mobiduka.co.ke', plan: 'Enterprise', status: 'active', cache: '2.8 GB', mpesa: '4360760', type: 'Till', reference: 'ELDORET01', lastSync: '18 sec ago' },
  { id: 'TEN-KE-01839', business: 'Barngetuny Plaza Shop 18', location: 'Nandi Hills, Nandi', owner: 'Brian Kiptoo', email: 'brian@barngetuny.co.ke', plan: 'Growth', status: 'active', cache: '846 MB', mpesa: '1787049', type: 'Till', reference: 'SHOP18', lastSync: '42 sec ago' },
  { id: 'TEN-KE-01811', business: 'Tulia Mini Mart', location: 'Kisumu Central', owner: 'Achieng Otieno', email: 'admin@tuliamart.co.ke', plan: 'Growth', status: 'active', cache: '1.2 GB', mpesa: '400200', type: 'Paybill', reference: 'TULIAHQ', lastSync: '1 min ago' },
  { id: 'TEN-KE-01798', business: 'Jirani Stores Nakuru', location: 'Nakuru East', owner: 'Samuel Mwangi', email: 'sam@jiranistores.co.ke', plan: 'Basic', status: 'trial', cache: '312 MB', mpesa: '512900', type: 'Paybill', reference: 'JIRANI', lastSync: '7 min ago' },
  { id: 'TEN-KE-01777', business: 'Pamoja Household Goods', location: 'Thika, Kiambu', owner: 'Faith Wambua', email: 'faith@pamojahg.co.ke', plan: 'Basic', status: 'suspended', cache: '188 MB', mpesa: '902144', type: 'Till', reference: 'PAMOJA', lastSync: '3 days ago' },
]

export const initialUsers: UserRecord[] = [
  { initials: 'DK', display: 'Dan Kip', legal: 'Daniel Kamar', id: 'UID-3001034', email: 'kamarster@gmail.com', role: 'SUPER_ADMIN', tenant: 'Platform', sessions: 3, lastSeen: 'Now', status: 'active' },
  { initials: 'DO', display: 'Diana O.', legal: 'Diana Kiplagat', id: 'USR-01842', email: 'diana@mobiduka.co.ke', role: 'STORE_OWNER', tenant: 'MobiDuka Eldoret', sessions: 2, lastSeen: '4 min ago', status: 'active' },
  { initials: 'BK', display: 'Brian K.', legal: 'Brian Kiptoo', id: 'USR-01839', email: 'brian@barngetuny.co.ke', role: 'STORE_OWNER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: '18 min ago', status: 'active' },
  { initials: 'GW', display: 'Grace W.', legal: 'Grace Wanjiku', id: 'USR-08411', email: 'grace@barngetuny.co.ke', role: 'CASHIER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: 'Now', status: 'active' },
  { initials: 'FO', display: 'Faith O.', legal: 'Faith Otieno', id: 'USR-07738', email: 'faith@tuliamart.co.ke', role: 'ACCOUNTANT', tenant: 'Tulia Mini Mart', sessions: 0, lastSeen: '2 days ago', status: 'locked' },
]

export const initialLicenses: LicenseRecord[] = [
  { id: 'LIC-88201', tenant: 'MobiDuka Eldoret Branch', plan: 'Enterprise', expires: '30 Sep 2026', days: 356, renewal: true, amount: 12500, status: 'active' },
  { id: 'LIC-88194', tenant: 'Barngetuny Plaza Shop 18', plan: 'Growth', expires: '18 Nov 2025', days: 40, renewal: true, amount: 5500, status: 'active' },
  { id: 'LIC-88122', tenant: 'Tulia Mini Mart', plan: 'Growth', expires: '02 Nov 2025', days: 24, renewal: false, amount: 5500, status: 'grace' },
  { id: 'LIC-88098', tenant: 'Jirani Stores Nakuru', plan: 'Basic', expires: '12 Oct 2025', days: 3, renewal: false, amount: 2500, status: 'grace' },
  { id: 'LIC-88044', tenant: 'Pamoja Household Goods', plan: 'Basic', expires: 'Expired 4 days ago', days: -4, renewal: false, amount: 2500, status: 'revoked' },
]

export const overviewTrendData = [
  { day: '01', volume: 920, tenants: 34 }, { day: '04', volume: 1080, tenants: 36 },
  { day: '07', volume: 990, tenants: 39 }, { day: '10', volume: 1340, tenants: 41 },
  { day: '13', volume: 1260, tenants: 46 }, { day: '16', volume: 1640, tenants: 49 },
  { day: '19', volume: 1520, tenants: 55 }, { day: '22', volume: 1920, tenants: 58 },
  { day: '25', volume: 2140, tenants: 63 }, { day: '28', volume: 2360, tenants: 67 },
]

export const liveTransactions = [
  { id: 'STK_9K4H2', store: 'Barngetuny Plaza · Shop 18', amount: 'KSh 4,850', time: '00:18', status: 'pending' },
  { id: 'STK_Q81MX', store: 'MobiDuka Eldoret · Main', amount: 'KSh 12,400', time: '00:04', status: 'complete' },
  { id: 'STK_4PA7D', store: 'Tulia Mini Mart · Kisumu', amount: 'KSh 890', time: '00:31', status: 'pending' },
  { id: 'STK_N2R9C', store: 'Jirani Stores · Nakuru', amount: 'KSh 2,150', time: '00:09', status: 'failed' },
]

export const apiRateData = [
  { time: '09:00', requests: 182 }, { time: '09:10', requests: 248 },
  { time: '09:20', requests: 216 }, { time: '09:30', requests: 354 },
  { time: '09:40', requests: 328 }, { time: '09:50', requests: 412 },
  { time: '10:00', requests: 386 }, { time: '10:10', requests: 468 },
]

export const initialSyncConflicts: SyncConflict[] = [
  { id: 'SYNC-CF-104', tenant: 'T-002', store: 'Barngetuny Plaza Shop 18', profile: 'HALTED - CONFLICT', description: 'Conflict on Product SKU 104 (Maize Flour): Terminal update (Qty: 10) vs Store Owner update (Qty: 15)', updated: '12 sec ago' },
  { id: 'SYNC-CF-091', tenant: 'T-018', store: 'Tulia Mini Mart', profile: 'RETRYING', description: 'Receipt sequence 44019 has diverging offline tax totals on TERMINAL_KSM_04.', updated: '41 sec ago' },
]

export const initialInfrastructureSentryEvents = [
  { id: 'SEN-401-8F2', message: 'ERROR: 401 Unauthorized API request failed caused by invalid token on sourcemap upload node.', trace: 'at uploadSourceMap (/app/build/sentry.ts:84:17)', time: '10:14:08.291 EAT', resolved: false },
  { id: 'SEN-500-2A9', message: 'ERROR: Prisma connection pool timeout after 10,000ms on tenant shard KE-WEST-02.', trace: 'at TenantPrisma.acquire (/app/db/pool.ts:119:9)', time: '09:52:44.018 EAT', resolved: false },
]

export const initialExpenseAudits: ExpenseAudit[] = [
  { id: 'EXP-90218', tenant: 'T-002', category: 'Supplier Petty Cash', amount: 12000, owner: 'Brian Kiptoo', status: 'awaiting' },
  { id: 'EXP-90177', tenant: 'T-018', category: 'Emergency Generator Fuel', amount: 8500, owner: 'Achieng Otieno', status: 'approved' },
]

export const initialProcurementOrders: ProcurementOrder[] = [
  { id: 'PO-2026-00918', supplier: 'Eldoret Wholesalers Ltd', tenant: 'T-002', value: 284000, progress: 68, eta: 'ETA 14 Oct · 16:30 EAT' },
  { id: 'PO-2026-00911', supplier: 'Rift Valley FMCG Supply', tenant: 'T-041', value: 148500, progress: 92, eta: 'ETA today · 18:00 EAT' },
]
