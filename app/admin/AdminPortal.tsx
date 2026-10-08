"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type IconName =
  | 'overview' | 'tenants' | 'identity' | 'licenses' | 'activity' | 'search'
  | 'bell' | 'chevron' | 'store' | 'revenue' | 'pulse' | 'churn'
  | 'shield' | 'settings' | 'external' | 'close' | 'check' | 'warning'

function AdminIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    tenants: <><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/></>,
    identity: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></>,
    licenses: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2Z"/><path d="M8 8h8M8 12h5"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    store: <><path d="M4 10v10h16V10"/><path d="M3 4h18l-2 6H5Z"/><path d="M9 20v-6h6v6"/></>,
    revenue: <><path d="M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5"/></>,
    pulse: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    churn: <><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.6 15A8 8 0 0 0 19 18.4L20 14M4 10l1-4.4A8 8 0 0 1 18.4 9"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21h-4v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.2-2.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 10 3.1V3h4v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1L19.8 7l-.1.1A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    external: <><path d="M14 3h7v7"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const navigation = [
  { to: '/admin', label: 'Overview', icon: 'overview' as IconName, end: true },
  { to: '/admin/infrastructure', label: 'Infrastructure', icon: 'activity' as IconName },
  { to: '/admin/tenants', label: 'Tenants', icon: 'tenants' as IconName },
  { to: '/admin/identity', label: 'Identity & Roles', icon: 'identity' as IconName },
  { to: '/admin/licenses', label: 'Licenses', icon: 'licenses' as IconName },
]

type UserRecord = {
  initials: string; display: string; legal: string; id: string; email: string
  role: string; tenant: string; sessions: number; lastSeen: string; status: string
}

type AdminModalType = 'tenant' | 'user' | 'license' | null

type AdminContext = {
  tenants: Tenant[]
  setTenants: Dispatch<SetStateAction<Tenant[]>>
  users: UserRecord[]
  setUsers: Dispatch<SetStateAction<UserRecord[]>>
  licenses: LicenseRecord[]
  setLicenses: Dispatch<SetStateAction<LicenseRecord[]>>
  period: '30 Days' | 'Quarter' | 'Year'
  setPeriod: Dispatch<SetStateAction<'30 Days' | 'Quarter' | 'Year'>>
  monitorOpen: boolean
  setMonitorOpen: Dispatch<SetStateAction<boolean>>
  openCreate: (type: Exclude<AdminModalType, null>) => void
}

const AdminDataContext = createContext<AdminContext | null>(null)

const useAdminData = () => {
  const context = useContext(AdminDataContext)
  if (!context) throw new Error('Admin pages must be rendered inside the admin layout.')
  return context
}

function downloadCsv(filename: string, rows: Record<string, string | number | boolean>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function AdminCrudModal({ type, onClose, onCreate }: {
  type: Exclude<AdminModalType, null>
  onClose: () => void
  onCreate: (payload: Record<string, string>) => void
}) {
  const [form, setForm] = useState<Record<string, string>>(
    type === 'tenant'
      ? { business: '', location: '', owner: '', email: '', plan: 'Basic', accountType: 'Till', shortcode: '', reference: '' }
      : type === 'user'
        ? { legal: '', email: '', role: 'STORE_OWNER', tenant: 'Platform' }
        : { tenant: '', plan: 'Basic', expires: '2026-12-31', amount: '2500' },
  )
  const titles = {
    tenant: ['Add tenant', 'Provision a new business workspace and payment node.'],
    user: ['Invite platform user', 'Create an identity and assign its initial tenant scope.'],
    license: ['Issue license', 'Provision a commercial tier and enforcement timeline.'],
  }
  const update = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onCreate(form)
  }

  return (
    <div className="admin-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <form className="admin-modal" onSubmit={submit}>
        <div className="admin-modal-head">
          <div><span>CREATE RECORD</span><h2>{titles[type][0]}</h2><p>{titles[type][1]}</p></div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close"><AdminIcon name="close"/></button>
        </div>
        <div className="admin-modal-body">
          {type === 'tenant' && <>
            <div className="admin-form-grid two">
              <label><span>Business name *</span><input required value={form.business} onChange={event => update('business', event.target.value)} placeholder="e.g. MobiDuka Westlands"/></label>
              <label><span>Location *</span><input required value={form.location} onChange={event => update('location', event.target.value)} placeholder="Town, County"/></label>
            </div>
            <div className="admin-form-grid two">
              <label><span>Owner legal name *</span><input required value={form.owner} onChange={event => update('owner', event.target.value)} placeholder="Full name"/></label>
              <label><span>Owner email *</span><input required type="email" value={form.email} onChange={event => update('email', event.target.value)} placeholder="owner@business.co.ke"/></label>
            </div>
            <div className="admin-form-grid two">
              <label><span>License tier</span><select value={form.plan} onChange={event => update('plan', event.target.value)}><option>Basic</option><option>Growth</option><option>Enterprise</option></select></label>
              <label><span>M-PESA account type</span><select value={form.accountType} onChange={event => update('accountType', event.target.value)}><option>Till</option><option>Paybill</option></select></label>
            </div>
            <div className="admin-form-grid two">
              <label><span>Business shortcode *</span><input required value={form.shortcode} onChange={event => update('shortcode', event.target.value.replace(/\D/g, ''))} placeholder="1787049"/></label>
              <label><span>Account reference</span><input value={form.reference} onChange={event => update('reference', event.target.value)} placeholder="WESTLANDS01"/></label>
            </div>
          </>}
          {type === 'user' && <>
            <label className="admin-field"><span>Verified legal name *</span><input required value={form.legal} onChange={event => update('legal', event.target.value)} placeholder="Daniel Kamar"/></label>
            <label className="admin-field"><span>Email ID *</span><input required type="email" value={form.email} onChange={event => update('email', event.target.value)} placeholder="name@mobiduka.co.ke"/></label>
            <div className="admin-form-grid two">
              <label><span>Role badge token</span><select value={form.role} onChange={event => update('role', event.target.value)}><option>SUPER_ADMIN</option><option>STORE_OWNER</option><option>ACCOUNTANT</option><option>CASHIER</option></select></label>
              <label><span>Tenant scope</span><input value={form.tenant} onChange={event => update('tenant', event.target.value)} placeholder="Platform or tenant name"/></label>
            </div>
          </>}
          {type === 'license' && <>
            <label className="admin-field"><span>Tenant identifier *</span><input required value={form.tenant} onChange={event => update('tenant', event.target.value)} placeholder="Business or tenant ID"/></label>
            <div className="admin-form-grid two">
              <label><span>Strategic tier</span><select value={form.plan} onChange={event => { update('plan', event.target.value); update('amount', event.target.value === 'Basic' ? '2500' : event.target.value === 'Growth' ? '5500' : '12500') }}><option>Basic</option><option>Growth</option><option>Enterprise</option></select></label>
              <label><span>Monthly value (KSh)</span><input required type="number" value={form.amount} onChange={event => update('amount', event.target.value)}/></label>
            </div>
            <label className="admin-field"><span>Contract expiration *</span><input required type="date" value={form.expires} onChange={event => update('expires', event.target.value)}/></label>
          </>}
        </div>
        <div className="admin-modal-footer">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
          <button className="admin-primary-button">{type === 'tenant' ? 'Create tenant' : type === 'user' ? 'Send invitation' : 'Provision license'}</button>
        </div>
      </form>
    </div>
  )
}

const pageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/admin': { eyebrow: 'Platform pulse', title: 'Global Overview', description: 'Live operating health across every MobiDuka tenant.' },
  '/admin/infrastructure': { eyebrow: 'Engineering operations', title: 'System Infrastructure & Telemetry Node', description: 'Backend routes, reconciliation, workers, devices, and hidden ecosystem pipelines.' },
  '/admin/tenants': { eyebrow: 'Business registry', title: 'Tenants & Businesses', description: 'Manage storefronts, owners, gateways, and platform access.' },
  '/admin/identity': { eyebrow: 'Access control', title: 'Identity & Roles', description: 'Platform-wide users, sessions, and role assignments.' },
  '/admin/licenses': { eyebrow: 'Monetization', title: 'License Management', description: 'Plans, renewals, enforcement, and recurring revenue controls.' },
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const meta = pageMeta[pathname] ?? pageMeta['/admin']
  const [tenants, setTenants] = useState<Tenant[]>(tenantData)
  const [users, setUsers] = useState<UserRecord[]>(initialUsers)
  const [licenses, setLicenses] = useState<LicenseRecord[]>(initialLicenses)
  const [period, setPeriod] = useState<'30 Days' | 'Quarter' | 'Year'>('30 Days')
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [createModal, setCreateModal] = useState<AdminModalType>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const openCreate = (type: Exclude<AdminModalType, null>) => {
    setCreateModal(type)
    setQuickOpen(false)
  }

  const createRecord = (payload: Record<string, string>) => {
    if (createModal === 'tenant') {
      setTenants(current => [{
        id: `TEN-KE-${String(1900 + current.length).padStart(5, '0')}`,
        business: payload.business, location: payload.location, owner: payload.owner, email: payload.email,
        plan: payload.plan, status: 'trial', cache: '0 MB', mpesa: payload.shortcode,
        type: payload.accountType as 'Till' | 'Paybill', reference: payload.reference || 'MOBIDUKA', lastSync: 'Not synced',
      }, ...current])
    }
    if (createModal === 'user') {
      const names = payload.legal.trim().split(/\s+/)
      setUsers(current => [{
        initials: names.map(name => name[0]).join('').slice(0, 2).toUpperCase(),
        display: `${names[0]} ${names[1]?.[0] ? `${names[1][0]}.` : ''}`.trim(),
        legal: payload.legal, email: payload.email, id: `UID-${3001035 + current.length}`,
        role: payload.role, tenant: payload.tenant, sessions: 0, lastSeen: 'Invitation pending', status: 'invited',
      }, ...current])
    }
    if (createModal === 'license') {
      const expiry = new Date(payload.expires)
      const days = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
      setLicenses(current => [{
        id: `LIC-${88202 + current.length}`, tenant: payload.tenant, plan: payload.plan,
        expires: expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        days, renewal: true, amount: Number(payload.amount), status: 'active',
      }, ...current])
    }
    setCreateModal(null)
  }

  const context: AdminContext = {
    tenants, setTenants, users, setUsers, licenses, setLicenses,
    period, setPeriod, monitorOpen, setMonitorOpen, openCreate,
  }

  return (
    <AdminDataContext.Provider value={context}>
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">M</div>
          <div className="admin-brand-copy">
            <strong>MobiDuka</strong>
            <span>Control Plane</span>
          </div>
        </div>

        <div className="admin-nav-label">Workspace</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(item => (
            <Link key={item.to} href={item.to} className={`admin-nav-item${(item.end ? pathname === item.to : pathname.startsWith(item.to)) ? ' active' : ''}`}>
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
              <AdminIcon name="chevron" size={14} />
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-spacer" />
        <div className="admin-system-card">
          <div className="admin-system-top">
            <span className="admin-live-dot" />
            <span>All systems operational</span>
          </div>
          <div className="admin-system-stats">
            <span>API 99.99%</span>
            <span>v2.4.18</span>
          </div>
        </div>
        <a className="admin-back-link" href="/">
          <AdminIcon name="external" size={15} />
          Open POS prototype
        </a>
        <div className="admin-profile">
          <div className="admin-avatar">DK</div>
          <div>
            <strong>Daniel Kamar</strong>
            <span>SUPER_ADMIN</span>
          </div>
          <button className="admin-icon-button" aria-label="Admin settings"><AdminIcon name="settings" size={16} /></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-eyebrow">{meta.eyebrow}</div>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-global-search">
              <AdminIcon name="search" size={16} />
              <input aria-label="Search platform" placeholder="Search tenants, users, IDs…" />
              <kbd>⌘ K</kbd>
            </div>
            <div className="admin-popover-anchor">
              <button type="button" className="admin-icon-button has-alert" onClick={() => setNotificationsOpen(value => !value)} aria-label="Notifications" aria-expanded={notificationsOpen}><AdminIcon name="bell" size={16}/></button>
              {notificationsOpen && (
                <div className="admin-notifications-popover">
                  <div className="admin-popover-head"><div><span>INFRASTRUCTURE LOGS</span><strong>Notifications</strong></div><button className="admin-icon-button" onClick={() => setNotificationsOpen(false)}><AdminIcon name="close" size={14}/></button></div>
                  <div className="admin-notification warning"><AdminIcon name="warning" size={16}/><div><strong>Webhook delivery failed</strong><span>Shortcode 1786003 · Tenant T-002</span><small>2 minutes ago</small></div></div>
                  <div className="admin-notification success"><AdminIcon name="check" size={16}/><div><strong>Cryptographic handshake rotation completed</strong><span>Till 1787049 · AES keyring healthy</span><small>11 minutes ago</small></div></div>
                  <button className="admin-text-button">Open infrastructure log</button>
                </div>
              )}
            </div>
            <div className="admin-popover-anchor">
              <button className="admin-primary-button" onClick={() => setQuickOpen(value => !value)}><span>+</span> Quick create</button>
              {quickOpen && (
                <div className="admin-quick-menu">
                  <button onClick={() => openCreate('tenant')}><AdminIcon name="tenants" size={16}/><div><strong>Tenant workspace</strong><span>Business, owner and M-PESA node</span></div></button>
                  <button onClick={() => openCreate('user')}><AdminIcon name="identity" size={16}/><div><strong>User identity</strong><span>Invite and assign RBAC scope</span></div></button>
                  <button onClick={() => openCreate('license')}><AdminIcon name="licenses" size={16}/><div><strong>Strategic license</strong><span>Provision tier and contract</span></div></button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>
      {createModal && <AdminCrudModal type={createModal} onClose={() => setCreateModal(null)} onCreate={createRecord}/>}
    </div>
    </AdminDataContext.Provider>
  )
}

const trendData = [
  { day: '01', volume: 920, tenants: 34 }, { day: '04', volume: 1080, tenants: 36 },
  { day: '07', volume: 990, tenants: 39 }, { day: '10', volume: 1340, tenants: 41 },
  { day: '13', volume: 1260, tenants: 46 }, { day: '16', volume: 1640, tenants: 49 },
  { day: '19', volume: 1520, tenants: 55 }, { day: '22', volume: 1920, tenants: 58 },
  { day: '25', volume: 2140, tenants: 63 }, { day: '28', volume: 2360, tenants: 67 },
]

const liveTransactions = [
  { id: 'STK_9K4H2', store: 'Barngetuny Plaza · Shop 18', amount: 'KSh 4,850', time: '00:18', status: 'pending' },
  { id: 'STK_Q81MX', store: 'MobiDuka Eldoret · Main', amount: 'KSh 12,400', time: '00:04', status: 'complete' },
  { id: 'STK_4PA7D', store: 'Tulia Mini Mart · Kisumu', amount: 'KSh 890', time: '00:31', status: 'pending' },
  { id: 'STK_N2R9C', store: 'Jirani Stores · Nakuru', amount: 'KSh 2,150', time: '00:09', status: 'failed' },
]

export function AdminOverview() {
  const { period, setPeriod, monitorOpen, setMonitorOpen } = useAdminData()
  const chartData = useMemo(() => trendData.map((point, index) => ({
    ...point,
    volume: Math.round(point.volume * (period === 'Quarter' ? 1.85 : period === 'Year' ? 4.6 : 1)),
    tenants: Math.round(point.tenants * (period === 'Quarter' ? 1.18 : period === 'Year' ? 1.62 : 1)),
    day: period === '30 Days' ? point.day : period === 'Quarter' ? `W${index + 1}` : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][index],
  })), [period])
  const metrics = [
    { label: 'Annual recurring revenue', value: 'KSh 48.6M', delta: '+18.4%', note: 'vs last quarter', icon: 'revenue' as IconName, tone: 'gold' },
    { label: 'Active tenants', value: '1,284', delta: '+47', note: 'this month', icon: 'store' as IconName, tone: 'blue' },
    { label: 'Platform GTV', value: 'KSh 2.18B', delta: '+24.1%', note: '30-day volume', icon: 'pulse' as IconName, tone: 'green' },
    { label: 'Revenue churn', value: '1.8%', delta: '-0.4%', note: 'healthy range', icon: 'churn' as IconName, tone: 'violet' },
  ]
  return (
    <div className="admin-page-stack">
      <div className="admin-section-head">
        <div className="admin-date-filter"><span className="admin-live-dot" /> Live platform data</div>
        <div className="admin-overview-controls">
          <div className="admin-period-control">
            {(['30 Days', 'Quarter', 'Year'] as const).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}
          </div>
          <label className="admin-monitor-toggle">
            <button className={`admin-toggle ${monitorOpen ? 'on' : ''}`} onClick={() => setMonitorOpen(value => !value)} aria-pressed={monitorOpen}><span/></button>
            Open Transaction Telemetry Monitor
          </label>
        </div>
      </div>
      <section className="admin-metric-grid">
        {metrics.map(metric => (
          <article className="admin-metric-card" key={metric.label}>
            <div className={`admin-metric-icon ${metric.tone}`}><AdminIcon name={metric.icon} /></div>
            <div className="admin-metric-label">{metric.label}</div>
            <div className="admin-metric-value">{metric.value}</div>
            <div className="admin-metric-foot"><strong>{metric.delta}</strong><span>{metric.note}</span></div>
          </article>
        ))}
      </section>

      <section className="admin-bento-grid">
        <article className="admin-panel admin-chart-panel">
          <div className="admin-panel-heading">
            <div><span>Processing telemetry</span><h2>Volume & tenant growth</h2></div>
            <div className="admin-legend"><span><i className="volume" /> Processing volume</span><span><i className="tenant" /> Active tenants</span></div>
          </div>
          <div className="admin-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2E7D32" stopOpacity={0.4}/><stop offset="100%" stopColor="#2E7D32" stopOpacity={0}/></linearGradient>
                  <linearGradient id="tenantGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4E7FE8" stopOpacity={0.3}/><stop offset="100%" stopColor="#4E7FE8" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false}/>
                <XAxis dataKey="day" stroke="#60708E" tickLine={false} axisLine={false} fontSize={11}/>
                <YAxis stroke="#60708E" tickLine={false} axisLine={false} fontSize={11}/>
                <Tooltip contentStyle={{ background: '#0D1930', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#E8EEFC' }}/>
                <Area type="monotone" dataKey="volume" stroke="#48A95A" strokeWidth={2.5} fill="url(#volumeGradient)"/>
                <Area type="monotone" dataKey="tenants" stroke="#4E7FE8" strokeWidth={2} fill="url(#tenantGradient)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-panel admin-stream-panel">
          <div className="admin-panel-heading">
            <div><span>Live node stream</span><h2>Active checkouts</h2></div>
            <div className="admin-stream-count"><span className="admin-live-dot" /> 18 live</div>
          </div>
          <div className="admin-stream-list">
            {liveTransactions.map(transaction => (
              <div className="admin-stream-row" key={transaction.id}>
                <div className={`admin-stream-status ${transaction.status}`} />
                <div className="admin-stream-main">
                  <strong>{transaction.store}</strong>
                  <span>{transaction.id}</span>
                </div>
                <div className="admin-stream-meta">
                  <strong>{transaction.amount}</strong>
                  <span className={transaction.status}>{transaction.status === 'pending' ? transaction.time : transaction.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="admin-text-button" onClick={() => setMonitorOpen(true)}>Open transaction monitor <AdminIcon name="chevron" size={14}/></button>
        </article>
      </section>

      <section className="admin-health-grid">
        {[
          { name: 'Daraja gateway', value: 'Operational', detail: '182ms median response', tone: 'green' },
          { name: 'Synchronization queue', value: 'Active · 0ms', detail: '42 events processing', tone: 'blue' },
          { name: 'License service', value: 'Healthy', detail: '0 enforcement errors', tone: 'gold' },
          { name: 'Active terminals', value: '3,842', detail: 'across 1,284 tenants', tone: 'violet' },
        ].map(item => (
          <article className="admin-health-card" key={item.name}>
            <div className={`admin-health-spark ${item.tone}`}><span/><span/><span/><span/><span/></div>
            <div><span>{item.name}</span><strong>{item.value}</strong><small>{item.detail}</small></div>
          </article>
        ))}
      </section>
      {monitorOpen && (
        <div className="admin-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setMonitorOpen(false) }}>
          <div className="admin-monitor-modal">
            <div className="admin-modal-head"><div><span>LIVE PROCESSING FABRIC</span><h2>Transaction Telemetry Monitor</h2><p>Real-time M-PESA checkout nodes and webhook delivery state.</p></div><button className="admin-icon-button" onClick={() => setMonitorOpen(false)}><AdminIcon name="close"/></button></div>
            <div className="admin-monitor-stats">
              <div><span>Total GTV volume</span><strong>KSh 2.18B</strong><small>Across 1,284 tenants</small></div>
              <div><span>Median authorization</span><strong>2.4s</strong><small>−0.8s this hour</small></div>
              <div><span>Completion rate</span><strong>98.4%</strong><small>Last 500 requests</small></div>
            </div>
            <div className="admin-monitor-list">
              {liveTransactions.map(transaction => (
                <div className="admin-monitor-row" key={transaction.id}>
                  <span className={`admin-runtime-icon ${transaction.status}`}>{transaction.status === 'failed' ? '×' : transaction.status === 'complete' ? '✓' : ''}</span>
                  <div><strong>{transaction.store}</strong><span>{transaction.id} · Callback /api/mpesa/result</span></div>
                  <strong>{transaction.amount}</strong>
                  <span className={`admin-runtime-label ${transaction.status}`}>{transaction.status === 'pending' ? `PENDING · ${transaction.time}` : transaction.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const apiRateData = [
  { time: '09:00', requests: 182 }, { time: '09:10', requests: 248 },
  { time: '09:20', requests: 216 }, { time: '09:30', requests: 354 },
  { time: '09:40', requests: 328 }, { time: '09:50', requests: 412 },
  { time: '10:00', requests: 386 }, { time: '10:10', requests: 468 },
]

type SyncConflict = { id: string; tenant: string; store: string; profile: string; description: string; updated: string }
type ExpenseAudit = { id: string; tenant: string; category: string; amount: number; owner: string; status: 'awaiting' | 'approved' | 'rejected' }
type ProcurementOrder = { id: string; supplier: string; tenant: string; value: number; progress: number; eta: string }

export function AdminInfrastructure() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([
    { id: 'SYNC-CF-104', tenant: 'T-002', store: 'Barngetuny Plaza Shop 18', profile: 'HALTED - CONFLICT', description: 'Conflict on Product SKU 104 (Maize Flour): Terminal update (Qty: 10) vs Store Owner update (Qty: 15)', updated: '12 sec ago' },
    { id: 'SYNC-CF-091', tenant: 'T-018', store: 'Tulia Mini Mart', profile: 'RETRYING', description: 'Receipt sequence 44019 has diverging offline tax totals on TERMINAL_KSM_04.', updated: '41 sec ago' },
  ])
  const [broadcast, setBroadcast] = useState({ target: 'All Cashier Terminals', title: 'Scheduled Daraja Maintenance', message: 'Service Alert: Safaricom Daraja core ledger maintenance tonight from 11:59 PM EAT.' })
  const [broadcastStatus, setBroadcastStatus] = useState('')
  const [cron, setCron] = useState({ running: false, last: 'Today, 06:00 AM', next: 'Tomorrow, 06:00 AM', duration: '142ms' })
  const [deviceOpen, setDeviceOpen] = useState(true)
  const [deviceConfirm, setDeviceConfirm] = useState(false)
  const [apiToken, setApiToken] = useState('')
  const [sentryEvents, setSentryEvents] = useState([
    { id: 'SEN-401-8F2', message: 'ERROR: 401 Unauthorized API request failed caused by invalid token on sourcemap upload node.', trace: 'at uploadSourceMap (/app/build/sentry.ts:84:17)', time: '10:14:08.291 EAT', resolved: false },
    { id: 'SEN-500-2A9', message: 'ERROR: Prisma connection pool timeout after 10,000ms on tenant shard KE-WEST-02.', trace: 'at TenantPrisma.acquire (/app/db/pool.ts:119:9)', time: '09:52:44.018 EAT', resolved: false },
  ])
  const [expenses, setExpenses] = useState<ExpenseAudit[]>([
    { id: 'EXP-90218', tenant: 'T-002', category: 'Supplier Petty Cash', amount: 12000, owner: 'Brian Kiptoo', status: 'awaiting' },
    { id: 'EXP-90177', tenant: 'T-018', category: 'Emergency Generator Fuel', amount: 8500, owner: 'Achieng Otieno', status: 'approved' },
  ])
  const [orders, setOrders] = useState<ProcurementOrder[]>([
    { id: 'PO-2026-00918', supplier: 'Eldoret Wholesalers Ltd', tenant: 'T-002', value: 284000, progress: 68, eta: 'ETA 14 Oct · 16:30 EAT' },
    { id: 'PO-2026-00911', supplier: 'Rift Valley FMCG Supply', tenant: 'T-041', value: 148500, progress: 92, eta: 'ETA today · 18:00 EAT' },
  ])

  const runCron = () => {
    setCron(current => ({ ...current, running: true }))
    window.setTimeout(() => setCron({ running: false, last: 'Just now', next: 'Tomorrow, 06:00 AM', duration: '138ms' }), 900)
  }
  const sendBroadcast = () => {
    if (!broadcast.title.trim() || !broadcast.message.trim()) return
    setBroadcastStatus(`Queued for ${broadcast.target} · PUSH-${Date.now().toString().slice(-6)}`)
  }
  const generateToken = () => setApiToken(`mdk_live_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`)

  return (
    <div className="admin-page-stack">
      <section className="admin-infra-health">
        <div><span className="admin-live-dot"/><div><span>Daraja Gateway</span><strong>Operational</strong></div><code>182ms</code></div>
        <div><i className="cyan"/><div><span>Synchronization Queue</span><strong>Active · 0ms</strong></div><code>42 events</code></div>
        <div><AdminIcon name="check" size={16}/><div><span>License Service</span><strong>Healthy</strong></div><code>0 errors</code></div>
      </section>

      <section className="admin-infra-grid">
        <div className="admin-infra-column">
          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/sync</span><h2>Data Sync &amp; Collision Registry</h2></div><span className="admin-status-badge suspended"><i/>{conflicts.length} open</span></div>
            <div className="admin-conflict-list">
              {conflicts.length === 0 ? <div className="admin-compact-empty"><AdminIcon name="check"/><span>All reconciliation loops are converged.</span></div> : conflicts.map(conflict => (
                <div className="admin-conflict-row" key={conflict.id}>
                  <div className="admin-conflict-meta"><code>{conflict.tenant}</code><span>{conflict.store}</span><strong>{conflict.profile}</strong></div>
                  <p>{conflict.description}</p>
                  <div><code>{conflict.id} · {conflict.updated}</code><button onClick={() => setConflicts(current => current.filter(item => item.id !== conflict.id))}>Resolve Conflict via Server State</button></div>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/notifications</span><h2>Global Push Broadcaster</h2></div><AdminIcon name="bell" size={17}/></div>
            <div className="admin-infra-form">
              <label><span>Target account role</span><select value={broadcast.target} onChange={event => setBroadcast(current => ({ ...current, target: event.target.value }))}><option>All Cashier Terminals</option><option>Store Owners Only</option><option>Accountants &amp; Managers</option><option>All Tenant Devices</option></select></label>
              <label><span>Push title</span><input value={broadcast.title} onChange={event => setBroadcast(current => ({ ...current, title: event.target.value }))}/></label>
              <label><span>Message payload</span><textarea value={broadcast.message} onChange={event => setBroadcast(current => ({ ...current, message: event.target.value }))}/></label>
              {broadcastStatus && <div className="admin-execution-result"><AdminIcon name="check" size={14}/><code>{broadcastStatus}</code><button onClick={() => setBroadcastStatus('')}>Dismiss</button></div>}
              <button className="admin-execute-button" onClick={sendBroadcast}><AdminIcon name="activity" size={15}/> Broadcast Global Push Message</button>
            </div>
          </article>
        </div>

        <div className="admin-infra-column">
          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/cron/billing-warnings</span><h2>Cron Scheduler Registry Engine</h2></div><span className="admin-status-badge active"><i/>armed</span></div>
            <div className="admin-cron-metrics">
              <div><span>Last Run</span><strong>{cron.last}</strong></div>
              <div><span>Next Scheduled Runtime</span><strong>{cron.next}</strong></div>
              <div><span>Execution Duration</span><strong>{cron.duration}</strong></div>
            </div>
            <button className="admin-secondary-button admin-full-button" onClick={runCron} disabled={cron.running}>{cron.running ? 'Executing worker lifecycle…' : 'Manually Trigger Billing Warning Engine'}</button>
          </article>

          <article className="admin-panel admin-infra-card critical">
            <div className="admin-panel-heading"><div><span>app/api/cash/session</span><h2>Terminal Device Remote Kill-Switch</h2></div><span className={`admin-status-badge ${deviceOpen ? 'trial' : 'suspended'}`}><i/>{deviceOpen ? 'shift open' : 'vault closed'}</span></div>
            <div className="admin-device-block">
              <div><span>Hardware signature</span><code>FINGERPRINT_PAD_ADB_902</code></div>
              <div><span>Active shift token UUID</span><code>{deviceOpen ? '7fb9c2e4-11d8-4d17-a6d3-902f8e71bc20' : 'REVOKED'}</code></div>
              <div><span>Open drawer cash delta</span><code className="danger">Expected: KSh 14,500 | Logged: KSh 14,000</code></div>
            </div>
            {deviceOpen ? <div className="admin-device-action"><button className="admin-danger-button" onClick={() => setDeviceConfirm(true)}>Force Remote Close Shift &amp; Vault Balance</button>{deviceConfirm && <div className="admin-inline-confirm"><AdminIcon name="warning" size={16}/><div><strong>Force-close physical register?</strong><span>A KSh 500 cash variance will be written to the audit ledger.</span><div><button onClick={() => setDeviceConfirm(false)}>Cancel</button><button onClick={() => { setDeviceOpen(false); setDeviceConfirm(false) }}>Execute kill-switch</button></div></div></div>}</div> : <div className="admin-execution-result"><AdminIcon name="check" size={14}/><code>Remote close acknowledged · VAULT-902 locked</code></div>}
          </article>

          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api-docs</span><h2>Global API Documentation Explorer</h2></div><code className="admin-rate-code">468 req/min</code></div>
            <div className="admin-api-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiRateData} margin={{ top: 8, right: 8, left: -30, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                  <XAxis dataKey="time" stroke="#53627e" tickLine={false} axisLine={false} fontSize={8}/>
                  <YAxis stroke="#53627e" tickLine={false} axisLine={false} fontSize={8}/>
                  <Line type="monotone" dataKey="requests" stroke="#0288D1" strokeWidth={2.2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="admin-api-key">
              <div><span>Developer access controller</span><code>{apiToken || 'No active programmatic token'}</code></div>
              <button className={`admin-toggle ${apiToken ? 'on' : ''}`} onClick={() => apiToken ? setApiToken('') : generateToken()} aria-pressed={Boolean(apiToken)}><span/></button>
            </div>
            <button className="admin-secondary-button admin-full-button" onClick={generateToken}>Generate Programmatic Access Key Token</button>
          </article>
        </div>

        <div className="admin-infra-column">
          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/sentry-example-api</span><h2>Sentry Error Diagnostic Matrix</h2></div><span className="admin-status-badge suspended"><i/>{sentryEvents.filter(event => !event.resolved).length} active</span></div>
            <div className="admin-code-terminal">
              <div className="admin-terminal-bar"><i/><i/><i/><code>production-crash.log</code></div>
              {sentryEvents.map(event => <div className={`admin-error-trace ${event.resolved ? 'resolved' : ''}`} key={event.id}><div><code>{event.time}</code><span>{event.resolved ? 'RESOLVED' : 'ERROR'}</span></div><strong>{event.message}</strong><code>{event.trace}</code><div className="admin-trace-actions"><button onClick={() => setSentryEvents(current => current.map(item => item.id === event.id ? { ...item, resolved: !item.resolved } : item))}>{event.resolved ? 'Reopen' : 'Mark resolved'}</button><button onClick={() => setSentryEvents(current => current.filter(item => item.id !== event.id))}>Delete trace</button></div></div>)}
            </div>
          </article>

          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/expenses</span><h2>Expense Leakage Audit Tracker</h2></div><strong className="admin-mono">KSh {expenses.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</strong></div>
            <div className="admin-ledger-list">
              {expenses.map(expense => <div className="admin-ledger-row" key={expense.id}><div><code>{expense.tenant} · {expense.id}</code><strong>{expense.category}</strong><span>{expense.owner}</span></div><div><strong>KSh {expense.amount.toLocaleString()}</strong><span className={`admin-compliance-badge ${expense.status}`}>{expense.status === 'awaiting' ? 'Awaiting Owner Cross-Verification Approval' : expense.status}</span><div className="admin-ledger-actions">{expense.status === 'awaiting' && <><button onClick={() => setExpenses(current => current.map(item => item.id === expense.id ? { ...item, status: 'approved' } : item))}>Approve</button><button onClick={() => setExpenses(current => current.map(item => item.id === expense.id ? { ...item, status: 'rejected' } : item))}>Reject</button></>}<button onClick={() => setExpenses(current => current.filter(item => item.id !== expense.id))}>Delete</button></div></div></div>)}
            </div>
            <button className="admin-text-button" onClick={() => setExpenses(current => [...current, { id: `EXP-${90219 + current.length}`, tenant: 'T-NEW', category: 'Unclassified Operational Expense', amount: 0, owner: 'Pending assignment', status: 'awaiting' }])}>+ Create expense audit record</button>
          </article>

          <article className="admin-panel admin-infra-card">
            <div className="admin-panel-heading"><div><span>app/api/purchase-orders</span><h2>Procurement Pipeline Tracker</h2></div><span className="admin-status-badge active"><i/>{orders.length} active</span></div>
            <div className="admin-procurement-list">
              {orders.map(order => <div className="admin-procurement-row" key={order.id}><div className="admin-procurement-head"><div><code>{order.id} · {order.tenant}</code><strong>{order.supplier}</strong></div><strong>KSh {order.value.toLocaleString()}</strong></div><div className="admin-progress-track"><span style={{ width: `${order.progress}%` }}/></div><div className="admin-progress-meta"><code>{order.progress}% delivered · {order.eta}</code><div><button onClick={() => setOrders(current => current.map(item => item.id === order.id ? { ...item, progress: Math.min(100, item.progress + 10) } : item))}>Advance +10%</button><button onClick={() => setOrders(current => current.filter(item => item.id !== order.id))}>Remove</button></div></div></div>)}
            </div>
            <button className="admin-text-button" onClick={() => setOrders(current => [...current, { id: `PO-2026-${String(919 + current.length).padStart(5, '0')}`, supplier: 'Pending Supplier Assignment', tenant: 'T-NEW', value: 0, progress: 0, eta: 'ETA pending' }])}>+ Create procurement pipeline</button>
          </article>
        </div>
      </section>
    </div>
  )
}

type Tenant = {
  id: string; business: string; location: string; owner: string; email: string
  plan: string; status: 'active' | 'trial' | 'suspended'; cache: string; mpesa: string
  type: 'Till' | 'Paybill'; reference: string; lastSync: string
}

const tenantData: Tenant[] = [
  { id: 'TEN-KE-01842', business: 'MobiDuka Eldoret Branch', location: 'Eldoret, Uasin Gishu', owner: 'Diana Kiplagat', email: 'diana@mobiduka.co.ke', plan: 'Enterprise', status: 'active', cache: '2.8 GB', mpesa: '4360760', type: 'Till', reference: 'ELDORET01', lastSync: '18 sec ago' },
  { id: 'TEN-KE-01839', business: 'Barngetuny Plaza Shop 18', location: 'Nandi Hills, Nandi', owner: 'Brian Kiptoo', email: 'brian@barngetuny.co.ke', plan: 'Growth', status: 'active', cache: '846 MB', mpesa: '1787049', type: 'Till', reference: 'SHOP18', lastSync: '42 sec ago' },
  { id: 'TEN-KE-01811', business: 'Tulia Mini Mart', location: 'Kisumu Central', owner: 'Achieng Otieno', email: 'admin@tuliamart.co.ke', plan: 'Growth', status: 'active', cache: '1.2 GB', mpesa: '400200', type: 'Paybill', reference: 'TULIAHQ', lastSync: '1 min ago' },
  { id: 'TEN-KE-01798', business: 'Jirani Stores Nakuru', location: 'Nakuru East', owner: 'Samuel Mwangi', email: 'sam@jiranistores.co.ke', plan: 'Basic', status: 'trial', cache: '312 MB', mpesa: '512900', type: 'Paybill', reference: 'JIRANI', lastSync: '7 min ago' },
  { id: 'TEN-KE-01777', business: 'Pamoja Household Goods', location: 'Thika, Kiambu', owner: 'Faith Wambua', email: 'faith@pamojahg.co.ke', plan: 'Basic', status: 'suspended', cache: '188 MB', mpesa: '902144', type: 'Till', reference: 'PAMOJA', lastSync: '3 days ago' },
]

export function AdminTenants() {
  const { tenants, setTenants, openCreate } = useAdminData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [auditState, setAuditState] = useState<'idle' | 'checking' | 'passed'>('idle')
  const filtered = tenants.filter(tenant =>
    (status === 'all' || tenant.status === status) &&
    `${tenant.business} ${tenant.owner} ${tenant.id}`.toLowerCase().includes(query.toLowerCase()),
  )

  const auditWebhook = () => {
    setAuditState('checking')
    window.setTimeout(() => setAuditState('passed'), 900)
  }
  const updateSelected = <K extends keyof Tenant>(key: K, value: Tenant[K]) => setSelected(current => current ? { ...current, [key]: value } : current)
  const saveTenant = () => {
    if (!selected) return
    setTenants(current => current.map(tenant => tenant.id === selected.id ? selected : tenant))
    setSelected(null)
  }
  const deleteTenant = () => {
    if (!selected) return
    setTenants(current => current.filter(tenant => tenant.id !== selected.id))
    setSelected(null)
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-toolbar">
        <div className="admin-search-field"><AdminIcon name="search" size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search businesses, owners, tenant IDs…"/></div>
        <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select>
        <button className="admin-secondary-button" onClick={() => downloadCsv('mobiduka-tenant-registry.csv', filtered.map(tenant => ({
          TenantID: tenant.id, Business: tenant.business, Owner: tenant.owner, Email: tenant.email,
          License: tenant.plan, Status: tenant.status, MpesaNode: tenant.mpesa, AccountType: tenant.type,
        })))}>Export Registry (CSV)</button>
        <button className="admin-primary-button" onClick={() => openCreate('tenant')}><span>+</span> Add tenant</button>
      </div>

      <div className="admin-table-panel">
        <div className="admin-table-summary">
          <div><strong>{filtered.length}</strong><span>businesses shown</span></div>
          <div className="admin-summary-chips"><span><i className="active"/> 1,241 active</span><span><i className="trial"/> 31 trials</span><span><i className="suspended"/> 12 suspended</span></div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Business / tenant</th><th>Owner profile</th><th>License</th><th>Cache load</th><th>M-PESA node</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map(tenant => (
                <tr key={tenant.id} onClick={() => { setSelected(tenant); setAuditState('idle') }}>
                  <td><div className="admin-business-cell"><div className="admin-store-avatar">{tenant.business.slice(0, 2).toUpperCase()}</div><div><strong>{tenant.business}</strong><span>{tenant.id} · {tenant.location}</span></div></div></td>
                  <td><div className="admin-person-cell"><strong>{tenant.owner}</strong><span>{tenant.email}</span></div></td>
                  <td><span className={`admin-plan-badge ${tenant.plan.toLowerCase()}`}>{tenant.plan}</span></td>
                  <td><strong className="admin-mono">{tenant.cache}</strong><span className="admin-cell-sub">Synced {tenant.lastSync}</span></td>
                  <td><strong className="admin-mono">{tenant.mpesa}</strong><span className="admin-cell-sub">{tenant.type}</span></td>
                  <td><span className={`admin-status-badge ${tenant.status}`}><i/>{tenant.status}</span></td>
                  <td><button className="admin-row-button" aria-label={`Open ${tenant.business}`}><AdminIcon name="chevron" size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer"><span>Showing 1–{filtered.length} of 1,284 tenants</span><div><button disabled>Previous</button><button className="active">1</button><button>2</button><button>3</button><button>Next</button></div></div>
      </div>

      {selected && (
        <div className="admin-drawer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}>
          <aside className="admin-drawer">
            <div className="admin-drawer-head">
              <div className="admin-store-avatar large">{selected.business.slice(0, 2).toUpperCase()}</div>
              <div><span>{selected.id}</span><h2>{selected.business}</h2><p>{selected.location}</p></div>
              <button className="admin-icon-button" onClick={() => setSelected(null)} aria-label="Close tenant details"><AdminIcon name="close"/></button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-drawer-section-title"><AdminIcon name="shield" size={16}/><div><strong>Secure gateway configuration</strong><span>AES-256 encrypted connection layer</span></div><span className="admin-encrypted-badge">Encrypted</span></div>
              <div className="admin-form-grid two">
                <label><span>Account type</span><select value={selected.type} onChange={event => updateSelected('type', event.target.value as Tenant['type'])}><option>Till</option><option>Paybill</option></select></label>
                <label><span>Business shortcode</span><input value={selected.mpesa} onChange={event => updateSelected('mpesa', event.target.value.replace(/\D/g, ''))}/></label>
              </div>
              <label className="admin-field"><span>Account reference</span><input value={selected.reference} onChange={event => updateSelected('reference', event.target.value)}/></label>
              <label className="admin-field"><span>Daraja consumer key</span><div className="admin-secret-input"><input type="password" defaultValue="ck_live_4e8a713b29f"/><span>AES</span></div></label>
              <label className="admin-field"><span>Daraja consumer secret</span><div className="admin-secret-input"><input type="password" defaultValue="cs_live_92fb7a401de"/><span>AES</span></div></label>
              <label className="admin-field"><span>Lipa na M-PESA passkey</span><div className="admin-secret-input"><input type="password" defaultValue="bfb279f9aa9bdbc"/><span>AES</span></div></label>

              <div className={`admin-audit-result ${auditState}`}>
                <div><span className="admin-live-dot"/><div><strong>{auditState === 'passed' ? 'Webhook reachable' : auditState === 'checking' ? 'Auditing callback route…' : 'Webhook health audit'}</strong><span>{auditState === 'passed' ? 'HTTPS 200 · 182ms · Signature valid' : 'Verify callback reachability and signing.'}</span></div></div>
                <button onClick={auditWebhook} disabled={auditState === 'checking'}>{auditState === 'checking' ? 'Checking…' : 'Audit Secure Webhook Routing Link'}</button>
              </div>

              <div className="admin-drawer-section-title"><AdminIcon name="store" size={16}/><div><strong>Tenant controls</strong><span>Operational access and ownership</span></div></div>
              <div className="admin-detail-list">
                <div><span>Primary owner</span><strong>{selected.owner}</strong></div>
                <div><span>License tier</span><select className="admin-inline-select" value={selected.plan} onChange={event => updateSelected('plan', event.target.value)}><option>Basic</option><option>Growth</option><option>Enterprise</option></select></div>
                <div><span>Last data sync</span><strong>{selected.lastSync}</strong></div>
                <div><span>Operational status</span><select className="admin-inline-select" value={selected.status} onChange={event => updateSelected('status', event.target.value as Tenant['status'])}><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></div>
              </div>
            </div>
            <div className="admin-drawer-footer"><button className="admin-danger-button" onClick={deleteTenant}>Delete tenant</button><span/><button className="admin-secondary-button" onClick={() => setSelected(null)}>Cancel</button><button className="admin-primary-button" onClick={saveTenant}>Save secure configuration</button></div>
          </aside>
        </div>
      )}
    </div>
  )
}

const initialUsers: UserRecord[] = [
  { initials: 'DK', display: 'Dan Kip', legal: 'Daniel Kamar', id: 'UID-3001034', email: 'kamarster@gmail.com', role: 'SUPER_ADMIN', tenant: 'Platform', sessions: 3, lastSeen: 'Now', status: 'active' },
  { initials: 'DO', display: 'Diana O.', legal: 'Diana Kiplagat', id: 'USR-01842', email: 'diana@mobiduka.co.ke', role: 'STORE_OWNER', tenant: 'MobiDuka Eldoret', sessions: 2, lastSeen: '4 min ago', status: 'active' },
  { initials: 'BK', display: 'Brian K.', legal: 'Brian Kiptoo', id: 'USR-01839', email: 'brian@barngetuny.co.ke', role: 'STORE_OWNER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: '18 min ago', status: 'active' },
  { initials: 'GW', display: 'Grace W.', legal: 'Grace Wanjiku', id: 'USR-08411', email: 'grace@barngetuny.co.ke', role: 'CASHIER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: 'Now', status: 'active' },
  { initials: 'FO', display: 'Faith O.', legal: 'Faith Otieno', id: 'USR-07738', email: 'faith@tuliamart.co.ke', role: 'ACCOUNTANT', tenant: 'Tulia Mini Mart', sessions: 0, lastSeen: '2 days ago', status: 'locked' },
]

export function AdminIdentity() {
  const { users, setUsers, openCreate } = useAdminData()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [showAudit, setShowAudit] = useState(false)
  const filtered = users.filter(user => (role === 'all' || user.role === role) && `${user.display} ${user.legal} ${user.email} ${user.id}`.toLowerCase().includes(query.toLowerCase()))
  const roleCards = [
    { role: 'SUPER_ADMIN', users: 4, description: 'Master SaaS controls and cross-tenant overrides.', permissions: 48, tone: 'gold' },
    { role: 'STORE_OWNER', users: 1284, description: 'Tenant root access, staff and financial settings.', permissions: 31, tone: 'blue' },
    { role: 'ACCOUNTANT', users: 427, description: 'Reports, taxes, expenses and audit exports.', permissions: 18, tone: 'violet' },
    { role: 'CASHIER', users: 3812, description: 'Terminal sales, cart and assigned shift access.', permissions: 9, tone: 'green' },
  ]
  return (
    <div className="admin-page-stack">
      <section className="admin-role-grid">
        {roleCards.map(card => (
          <button className={`admin-role-card ${card.tone}`} key={card.role} onClick={() => setRole(role === card.role ? 'all' : card.role)}>
            <div className="admin-role-card-top"><span className={`admin-role-badge ${card.role.toLowerCase()}`}>{card.role}</span><strong>{card.users.toLocaleString()}</strong></div>
            <p>{card.description}</p>
            <div><span>{card.permissions} permissions</span><AdminIcon name="chevron" size={14}/></div>
          </button>
        ))}
      </section>
      <div className="admin-toolbar">
        <div className="admin-search-field"><AdminIcon name="search" size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search users, emails, system IDs…"/></div>
        <select value={role} onChange={event => setRole(event.target.value)}><option value="all">All roles</option><option>SUPER_ADMIN</option><option>STORE_OWNER</option><option>ACCOUNTANT</option><option>CASHIER</option></select>
        <button className="admin-secondary-button" onClick={() => downloadCsv('mobiduka-identity-ledger.csv', filtered.map(user => ({
          SystemID: user.id, LegalName: user.legal, Email: user.email, Role: user.role,
          Tenant: user.tenant, ActiveSessions: user.sessions, Status: user.status,
        })))}>Export Identity Ledger (CSV)</button>
        <button className="admin-secondary-button" onClick={() => setShowAudit(true)}>Access audit</button>
        <button className="admin-primary-button" onClick={() => openCreate('user')}><span>+</span> Invite user</button>
      </div>
      <div className="admin-table-panel">
        <div className="admin-table-summary"><div><strong>{filtered.length}</strong><span>identity records</span></div><div className="admin-summary-chips"><span><i className="active"/> 4,929 active sessions</span><span><i className="trial"/> 18 pending invites</span></div></div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>User identity</th><th>Verified legal name</th><th>Tenant scope</th><th>Clearance</th><th>Sessions</th><th>Last seen</th><th>Access control</th></tr></thead>
            <tbody>{filtered.map(user => (
              <tr key={user.id}>
                <td><div className="admin-business-cell"><div className="admin-user-avatar">{user.initials}</div><div><strong>{user.display}</strong><span>{user.id} · {user.email}</span></div></div></td>
                <td><div className="admin-verified-name"><AdminIcon name="check" size={13}/><strong>{user.legal}</strong></div></td>
                <td><strong>{user.tenant}</strong></td>
                <td><select className={`admin-role-select ${user.role.toLowerCase()}`} value={user.role} onChange={event => setUsers(current => current.map(record => record.id === user.id ? { ...record, role: event.target.value } : record))}><option>SUPER_ADMIN</option><option>STORE_OWNER</option><option>ACCOUNTANT</option><option>CASHIER</option></select></td>
                <td><div className="admin-session-count"><span>{user.sessions}</span><small>{user.sessions === 1 ? 'Active Device' : 'Active Devices'}</small></div></td>
                <td><strong>{user.lastSeen}</strong><span className={`admin-cell-sub ${user.status}`}>{user.status}</span></td>
                <td><div className="admin-row-actions"><button className="admin-danger-button" disabled={user.sessions === 0} onClick={() => setUsers(current => current.map(record => record.id === user.id ? { ...record, sessions: 0, status: 'locked', lastSeen: 'Terminated now' } : record))}>Terminate Active Session Node</button><button className="admin-row-button" aria-label={`Remove ${user.legal}`} onClick={() => setUsers(current => current.filter(record => record.id !== user.id))}><AdminIcon name="close" size={13}/></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="admin-table-footer"><span>Showing {filtered.length} of 5,527 platform users</span><div><button disabled>Previous</button><button className="active">1</button><button>2</button><button>Next</button></div></div>
      </div>
      {showAudit && (
        <div className="admin-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowAudit(false) }}>
          <div className="admin-audit-modal">
            <div className="admin-modal-head"><div><span>IAM EVENT STREAM</span><h2>Access Audit Ledger</h2><p>Privileged role changes, session destruction, and authentication events.</p></div><button className="admin-icon-button" onClick={() => setShowAudit(false)}><AdminIcon name="close"/></button></div>
            <div className="admin-audit-log">
              {[
                ['AUTH-8F21A', 'Daniel Kamar', 'SUPER_ADMIN login challenge passed', '102.68.14.22', 'Just now', 'success'],
                ['IAM-19CC4', 'Diana Kiplagat', 'STORE_OWNER role scope updated', '41.90.72.18', '14 min ago', 'success'],
                ['SES-71BA0', 'Faith Otieno', 'Concurrent terminal access terminated', '197.248.10.6', '2 hours ago', 'warning'],
                ['AUTH-40DD2', 'Unknown identity', 'Invalid refresh token rejected', '105.163.4.91', '3 hours ago', 'danger'],
              ].map(event => <div className="admin-audit-row" key={event[0]}><span className={`admin-runtime-icon ${event[5]}`}>{event[5] === 'success' ? '✓' : event[5] === 'danger' ? '×' : '!'}</span><div><strong>{event[2]}</strong><span>{event[0]} · {event[1]} · {event[3]}</span></div><time>{event[4]}</time></div>)}
            </div>
            <div className="admin-modal-footer"><button className="admin-secondary-button" onClick={() => downloadCsv('mobiduka-access-audit.csv', [
              { EventID: 'AUTH-8F21A', Identity: 'Daniel Kamar', Action: 'SUPER_ADMIN login challenge passed', Timestamp: 'Just now' },
              { EventID: 'IAM-19CC4', Identity: 'Diana Kiplagat', Action: 'STORE_OWNER role scope updated', Timestamp: '14 min ago' },
            ])}>Export audit CSV</button><button className="admin-primary-button" onClick={() => setShowAudit(false)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

type LicenseRecord = {
  id: string; tenant: string; plan: string; expires: string; days: number
  renewal: boolean; amount: number; status: 'active' | 'grace' | 'revoked'
}

const initialLicenses: LicenseRecord[] = [
  { id: 'LIC-88201', tenant: 'MobiDuka Eldoret Branch', plan: 'Enterprise', expires: '30 Sep 2026', days: 356, renewal: true, amount: 12500, status: 'active' },
  { id: 'LIC-88194', tenant: 'Barngetuny Plaza Shop 18', plan: 'Growth', expires: '18 Nov 2025', days: 40, renewal: true, amount: 5500, status: 'active' },
  { id: 'LIC-88122', tenant: 'Tulia Mini Mart', plan: 'Growth', expires: '02 Nov 2025', days: 24, renewal: false, amount: 5500, status: 'grace' },
  { id: 'LIC-88098', tenant: 'Jirani Stores Nakuru', plan: 'Basic', expires: '12 Oct 2025', days: 3, renewal: false, amount: 2500, status: 'grace' },
  { id: 'LIC-88044', tenant: 'Pamoja Household Goods', plan: 'Basic', expires: 'Expired 4 days ago', days: -4, renewal: false, amount: 2500, status: 'revoked' },
]

export function AdminLicenses() {
  const { licenses, setLicenses, openCreate } = useAdminData()
  const [rules, setRules] = useState<Record<string, boolean>>({ Basic: true, Growth: true, Enterprise: false })
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const plans = [
    { name: 'Basic', subtitle: 'Standard Duka', price: '2,500', tenants: 734, color: 'blue', features: ['1 store · 3 users', 'Core POS & inventory', 'Standard support'] },
    { name: 'Growth', subtitle: 'Multi-store operator', price: '5,500', tenants: 421, color: 'green', features: ['3 stores · 15 users', 'Reports & staff controls', 'Priority support'] },
    { name: 'Enterprise', subtitle: 'Mega-supermarket', price: '12,500+', tenants: 129, color: 'gold', features: ['Unlimited terminals', 'Advanced IAM & API', 'Dedicated success manager'] },
  ]
  const toggleRenewal = (id: string) => setLicenses(current => current.map(license => license.id === id ? { ...license, renewal: !license.renewal } : license))
  const revoke = (id: string) => {
    setLicenses(current => current.map(license => license.id === id ? { ...license, status: 'revoked', renewal: false } : license))
    setConfirmRevoke(null)
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-license-metrics">
        <div><span>Monthly recurring revenue</span><strong>KSh 4.05M</strong><small>+16.8% year over year</small></div>
        <div><span>Paid licenses</span><strong>1,253</strong><small>97.6% collection rate</small></div>
        <div><span>Renewal pipeline</span><strong>KSh 682K</strong><small>Due within 30 days</small></div>
        <div><span>Grace period</span><strong>19</strong><small>7 require intervention</small></div>
      </section>

      <section className="admin-plan-grid">
        {plans.map(plan => (
          <article className={`admin-plan-card ${plan.color}`} key={plan.name}>
            <div className="admin-plan-head"><div><span>{plan.subtitle}</span><h2>{plan.name}</h2></div><span className={`admin-plan-badge ${plan.name.toLowerCase()}`}>{plan.tenants} tenants</span></div>
            <div className="admin-plan-price"><strong>KSh {plan.price}</strong><span>/ month</span></div>
            <ul>{plan.features.map(feature => <li key={feature}><AdminIcon name="check" size={13}/>{feature}</li>)}</ul>
            <div className="admin-plan-rule">
              <div><strong>Deploy live upgrade rules</strong><span>Auto-enforce limits and upsell prompts</span></div>
              <button className={`admin-toggle ${rules[plan.name] ? 'on' : ''}`} onClick={() => setRules(current => ({ ...current, [plan.name]: !current[plan.name] }))} aria-pressed={rules[plan.name]}><span/></button>
            </div>
          </article>
        ))}
      </section>

      <div className="admin-table-panel">
        <div className="admin-table-title-row"><div><span>License ledger</span><h2>Contracts & enforcement</h2></div><div><button className="admin-secondary-button" onClick={() => downloadCsv('mobiduka-contract-matrix.csv', licenses.map(license => ({
          LicenseID: license.id, Tenant: license.tenant, Tier: license.plan, Expiration: license.expires,
          AutomaticRenewal: license.renewal, MonthlyValueKSh: license.amount, Status: license.status,
        })))}>Export Contract Matrix Ledger</button><button className="admin-primary-button" onClick={() => openCreate('license')}>Provision Strategic Tier Extension</button></div></div>
        <div className="admin-table-scroll">
          <table className="admin-table license-table">
            <thead><tr><th>Tenant identifier</th><th>License tier</th><th>Contract expiration</th><th>Auto renewal</th><th>Monthly value</th><th>Enforcement</th></tr></thead>
            <tbody>{licenses.map(license => (
              <tr key={license.id}>
                <td><div className="admin-person-cell"><strong>{license.tenant}</strong><span>{license.id}</span></div></td>
                <td><span className={`admin-plan-badge ${license.plan.toLowerCase()}`}>{license.plan}</span></td>
                <td><strong>{license.expires}</strong><span className={`admin-countdown ${license.days <= 7 ? 'urgent' : license.days <= 30 ? 'warning' : ''}`}>{license.days > 0 ? `${license.days} days remaining` : `${Math.abs(license.days)} days overdue`}</span></td>
                <td><div className="admin-renewal-cell"><button className={`admin-toggle ${license.renewal ? 'on' : ''}`} onClick={() => toggleRenewal(license.id)} disabled={license.status === 'revoked'} aria-pressed={license.renewal}><span/></button><small>{license.renewal ? 'Enabled' : 'Disabled'}</small></div></td>
                <td><strong className="admin-mono">KSh {license.amount.toLocaleString()}</strong></td>
                <td>{license.status === 'revoked' ? <div className="admin-row-actions"><span className="admin-status-badge suspended"><i/>Revoked</span><button className="admin-row-button" aria-label="Delete license" onClick={() => setLicenses(current => current.filter(record => record.id !== license.id))}><AdminIcon name="close" size={13}/></button></div> : <div className="admin-confirm-anchor"><button className="admin-danger-button" onClick={() => setConfirmRevoke(license.id)}>Revoke Operational Access Node</button>{confirmRevoke === license.id && <div className="admin-confirm-popover"><AdminIcon name="warning" size={17}/><div><strong>Strategic Contract License Expiration Revocation</strong><span>POS terminals will be blocked immediately.</span><div><button onClick={() => setConfirmRevoke(null)}>Cancel</button><button onClick={() => revoke(license.id)}>Confirm Access Node Revocation</button></div><button className="admin-permanent-remove" onClick={() => { setLicenses(current => current.filter(record => record.id !== license.id)); setConfirmRevoke(null) }}>Permanently Remove Revoked Ledger Record</button></div></div>}</div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminNotFound() {
  return <div className="admin-empty-state"><AdminIcon name="warning" size={34}/><h2>Admin page unavailable</h2><p>The requested control-plane route does not exist.</p><Link href="/admin">Return to overview</Link></div>
}
