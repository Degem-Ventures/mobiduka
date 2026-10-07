"use client";

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  const paths: Record<IconName, React.ReactNode> = {
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
  { to: '/admin/tenants', label: 'Tenants', icon: 'tenants' as IconName },
  { to: '/admin/identity', label: 'Identity & Roles', icon: 'identity' as IconName },
  { to: '/admin/licenses', label: 'Licenses', icon: 'licenses' as IconName },
]

const pageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/admin': { eyebrow: 'Platform pulse', title: 'Global Overview', description: 'Live operating health across every MobiDuka tenant.' },
  '/admin/tenants': { eyebrow: 'Business registry', title: 'Tenants & Businesses', description: 'Manage storefronts, owners, gateways, and platform access.' },
  '/admin/identity': { eyebrow: 'Access control', title: 'Identity & Roles', description: 'Platform-wide users, sessions, and role assignments.' },
  '/admin/licenses': { eyebrow: 'Monetization', title: 'License Management', description: 'Plans, renewals, enforcement, and recurring revenue controls.' },
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const meta = pageMeta[pathname] ?? pageMeta['/admin']

  return (
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
            <button className="admin-icon-button has-alert" aria-label="Notifications"><AdminIcon name="bell" /></button>
            <button className="admin-primary-button"><span>+</span> Quick create</button>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
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
        <div className="admin-period-control"><button className="active">30 days</button><button>Quarter</button><button>Year</button></div>
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
              <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
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
          <button className="admin-text-button">Open transaction monitor <AdminIcon name="chevron" size={14}/></button>
        </article>
      </section>

      <section className="admin-health-grid">
        {[
          { name: 'Daraja gateway', value: '99.98%', detail: '182ms median response', tone: 'green' },
          { name: 'Sync queue', value: '42', detail: 'events processing', tone: 'blue' },
          { name: 'License service', value: '100%', detail: '0 enforcement errors', tone: 'gold' },
          { name: 'Active terminals', value: '3,842', detail: 'across 1,284 tenants', tone: 'violet' },
        ].map(item => (
          <article className="admin-health-card" key={item.name}>
            <div className={`admin-health-spark ${item.tone}`}><span/><span/><span/><span/><span/></div>
            <div><span>{item.name}</span><strong>{item.value}</strong><small>{item.detail}</small></div>
          </article>
        ))}
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
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [auditState, setAuditState] = useState<'idle' | 'checking' | 'passed'>('idle')
  const filtered = tenantData.filter(tenant =>
    (status === 'all' || tenant.status === status) &&
    `${tenant.business} ${tenant.owner} ${tenant.id}`.toLowerCase().includes(query.toLowerCase()),
  )

  const auditWebhook = () => {
    setAuditState('checking')
    window.setTimeout(() => setAuditState('passed'), 900)
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-toolbar">
        <div className="admin-search-field"><AdminIcon name="search" size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search businesses, owners, tenant IDs…"/></div>
        <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select>
        <button className="admin-secondary-button">Export registry</button>
        <button className="admin-primary-button"><span>+</span> Add tenant</button>
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
                <label><span>Account type</span><select defaultValue={selected.type}><option>Till</option><option>Paybill</option></select></label>
                <label><span>Business shortcode</span><input defaultValue={selected.mpesa}/></label>
              </div>
              <label className="admin-field"><span>Account reference</span><input defaultValue={selected.reference}/></label>
              <label className="admin-field"><span>Daraja consumer key</span><div className="admin-secret-input"><input type="password" defaultValue="ck_live_4e8a713b29f"/><span>AES</span></div></label>
              <label className="admin-field"><span>Daraja consumer secret</span><div className="admin-secret-input"><input type="password" defaultValue="cs_live_92fb7a401de"/><span>AES</span></div></label>
              <label className="admin-field"><span>Lipa na M-PESA passkey</span><div className="admin-secret-input"><input type="password" defaultValue="bfb279f9aa9bdbc"/><span>AES</span></div></label>

              <div className={`admin-audit-result ${auditState}`}>
                <div><span className="admin-live-dot"/><div><strong>{auditState === 'passed' ? 'Webhook reachable' : auditState === 'checking' ? 'Auditing callback route…' : 'Webhook health audit'}</strong><span>{auditState === 'passed' ? 'HTTPS 200 · 182ms · Signature valid' : 'Verify callback reachability and signing.'}</span></div></div>
                <button onClick={auditWebhook} disabled={auditState === 'checking'}>{auditState === 'checking' ? 'Checking…' : 'Audit Webhook Status'}</button>
              </div>

              <div className="admin-drawer-section-title"><AdminIcon name="store" size={16}/><div><strong>Tenant controls</strong><span>Operational access and ownership</span></div></div>
              <div className="admin-detail-list">
                <div><span>Primary owner</span><strong>{selected.owner}</strong></div>
                <div><span>License tier</span><strong>{selected.plan}</strong></div>
                <div><span>Last data sync</span><strong>{selected.lastSync}</strong></div>
                <div><span>Operational status</span><span className={`admin-status-badge ${selected.status}`}><i/>{selected.status}</span></div>
              </div>
            </div>
            <div className="admin-drawer-footer"><button className="admin-secondary-button" onClick={() => setSelected(null)}>Cancel</button><button className="admin-primary-button">Save secure configuration</button></div>
          </aside>
        </div>
      )}
    </div>
  )
}

const users = [
  { initials: 'DK', display: 'Dan Kip', legal: 'Daniel Kamar', id: 'USR-00182', email: 'daniel@mobiduka.co.ke', role: 'SUPER_ADMIN', tenant: 'Platform', sessions: 3, lastSeen: 'Now', status: 'active' },
  { initials: 'DO', display: 'Diana O.', legal: 'Diana Kiplagat', id: 'USR-01842', email: 'diana@mobiduka.co.ke', role: 'STORE_OWNER', tenant: 'MobiDuka Eldoret', sessions: 2, lastSeen: '4 min ago', status: 'active' },
  { initials: 'BK', display: 'Brian K.', legal: 'Brian Kiptoo', id: 'USR-01839', email: 'brian@barngetuny.co.ke', role: 'STORE_OWNER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: '18 min ago', status: 'active' },
  { initials: 'GW', display: 'Grace W.', legal: 'Grace Wanjiku', id: 'USR-08411', email: 'grace@barngetuny.co.ke', role: 'CASHIER', tenant: 'Barngetuny Plaza', sessions: 1, lastSeen: 'Now', status: 'active' },
  { initials: 'FO', display: 'Faith O.', legal: 'Faith Otieno', id: 'USR-07738', email: 'faith@tuliamart.co.ke', role: 'ACCOUNTANT', tenant: 'Tulia Mini Mart', sessions: 0, lastSeen: '2 days ago', status: 'locked' },
]

export function AdminIdentity() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
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
        <button className="admin-secondary-button">Access audit</button>
        <button className="admin-primary-button"><span>+</span> Invite user</button>
      </div>
      <div className="admin-table-panel">
        <div className="admin-table-summary"><div><strong>{filtered.length}</strong><span>identity records</span></div><div className="admin-summary-chips"><span><i className="active"/> 4,929 active sessions</span><span><i className="trial"/> 18 pending invites</span></div></div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>User identity</th><th>Verified legal name</th><th>Tenant scope</th><th>Clearance</th><th>Sessions</th><th>Last seen</th><th /></tr></thead>
            <tbody>{filtered.map(user => (
              <tr key={user.id}>
                <td><div className="admin-business-cell"><div className="admin-user-avatar">{user.initials}</div><div><strong>{user.display}</strong><span>{user.id} · {user.email}</span></div></div></td>
                <td><div className="admin-verified-name"><AdminIcon name="check" size={13}/><strong>{user.legal}</strong></div></td>
                <td><strong>{user.tenant}</strong></td>
                <td><span className={`admin-role-badge ${user.role.toLowerCase()}`}>{user.role}</span></td>
                <td><div className="admin-session-count"><span>{user.sessions}</span><small>{user.sessions === 1 ? 'device' : 'devices'}</small></div></td>
                <td><strong>{user.lastSeen}</strong><span className={`admin-cell-sub ${user.status}`}>{user.status}</span></td>
                <td><button className="admin-row-button"><AdminIcon name="chevron" size={15}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="admin-table-footer"><span>Showing {filtered.length} of 5,527 platform users</span><div><button disabled>Previous</button><button className="active">1</button><button>2</button><button>Next</button></div></div>
      </div>
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
  const [rules, setRules] = useState<Record<string, boolean>>({ Basic: true, Growth: true, Enterprise: false })
  const [licenses, setLicenses] = useState(initialLicenses)
  const plans = [
    { name: 'Basic', subtitle: 'Standard Duka', price: '2,500', tenants: 734, color: 'blue', features: ['1 store · 3 users', 'Core POS & inventory', 'Standard support'] },
    { name: 'Growth', subtitle: 'Multi-store operator', price: '5,500', tenants: 421, color: 'green', features: ['3 stores · 15 users', 'Reports & staff controls', 'Priority support'] },
    { name: 'Enterprise', subtitle: 'Mega-supermarket', price: '12,500+', tenants: 129, color: 'gold', features: ['Unlimited terminals', 'Advanced IAM & API', 'Dedicated success manager'] },
  ]
  const toggleRenewal = (id: string) => setLicenses(current => current.map(license => license.id === id ? { ...license, renewal: !license.renewal } : license))
  const revoke = (id: string) => {
    if (!window.confirm('Revoke operational access for this tenant?')) return
    setLicenses(current => current.map(license => license.id === id ? { ...license, status: 'revoked', renewal: false } : license))
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
        <div className="admin-table-title-row"><div><span>License ledger</span><h2>Contracts & enforcement</h2></div><div><button className="admin-secondary-button">Export ledger</button><button className="admin-primary-button">Issue license</button></div></div>
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
                <td>{license.status === 'revoked' ? <span className="admin-status-badge suspended"><i/>Revoked</span> : <button className="admin-danger-button" onClick={() => revoke(license.id)}>Revoke access</button>}</td>
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
