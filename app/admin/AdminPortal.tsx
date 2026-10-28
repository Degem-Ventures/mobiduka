"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTheme } from '../context/ThemeContext'
import PlanCatalogEditor from '../plans/PlanCatalogEditor'
import PlatformPaymentLedger from '../plans/PlatformPaymentLedger'
import { AdminDataProvider, useAdminData } from './AdminDataProvider'
import {
  adminPageMeta,
  apiRateData,
  initialExpenseAudits,
  initialInfrastructureSentryEvents,
  initialProcurementOrders,
  initialSyncConflicts,
  liveTransactions,
  overviewTrendData,
  type ExpenseAudit,
  type ProcurementOrder,
  type SyncConflict,
  type Tenant,
} from './admin-data'
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
  | 'layout' | 'workflow' | 'buildings' | 'key' | 'wallet' | 'payment'
  | 'server' | 'lifeBuoy' | 'receipt' | 'webhook' | 'clock' | 'alert' | 'device' | 'sync'
  | 'tenantHealth' | 'user' | 'role' | 'sessions' | 'audit' | 'subscription'
  | 'invoice' | 'billingPayment' | 'license' | 'mpesa' | 'reconcile'
  | 'paymentEvent' | 'securityCenter' | 'compliance' | 'securityEvent' | 'infrastructure'
  | 'flag' | 'integration' | 'backup' | 'platformSettings' | 'support'
  | 'announcement' | 'status' | 'sun' | 'moon' | 'monitor'

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
    layout: <><rect x="3" y="3" width="8" height="7" rx="1.5"/><rect x="13" y="3" width="8" height="4" rx="1.5"/><rect x="13" y="9" width="8" height="12" rx="1.5"/><rect x="3" y="12" width="8" height="9" rx="1.5"/></>,
    workflow: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h4a2 2 0 0 1 2 2v7M15 11l-3 3 3 3"/></>,
    buildings: <><path d="M3 21h18M5 21V5l7-2v18M12 9h7v12M8 7h1M8 11h1M8 15h1M15 12h1M15 16h1"/></>,
    key: <><circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 9-9M17 6l2 2M14 9l2 2"/></>,
    wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14a2 2 0 0 1 2 2v4h-5a2 2 0 0 0 0 4h5M15 15h.01"/></>,
    payment: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    server: <><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/></>,
    lifeBuoy: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m5.6 5.6 4.3 4.3m4.2 4.2 4.3 4.3m0-12.8-4.3 4.3m-4.2 4.2-4.3 4.3"/></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    webhook: <><path d="M8 8a4 4 0 1 1 6.8 2.8L12 13.5M8 8l2-2M8 8l-2 2"/><path d="M12 13.5a4 4 0 1 0 4 6.9l1-3.7M16 20.4l3 .3-.3-3"/><path d="M12 13.5a4 4 0 1 0-4-6.9"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M12 3 2.8 19h18.4z"/><path d="M12 9v4M12 16h.01"/></>,
    tenantHealth: <><path d="M3 12h4l2-5 4 10 2-5h6"/><path d="M4 4h16v16H4z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    role: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M9 12h6M12 9v6"/></>,
    sessions: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 17h4M9 7h6"/></>,
    audit: <><path d="M8 3h8l4 4v14H4V3z"/><path d="M16 3v5h4M8 12h8M8 16h6"/></>,
    subscription: <><path d="M4 7h16M4 12h16M4 17h10"/><path d="M7 3v4M17 3v4M17 15l3 3-3 3"/></>,
    invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    billingPayment: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c0-1-1.3-1.8-3-1.8s-3 .8-3 1.8 1.3 1.8 3 1.8 3 .8 3 1.8-1.3 1.8-3 1.8-3-.8-3-1.8M12 5v14"/></>,
    license: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    mpesa: <><path d="M5 19c1-6 3-10 5-10 2 0 2 6 4 6s3-4 5-10"/><path d="M4 5h4M16 19h4"/></>,
    reconcile: <><path d="M20 7h-6V1M4 17h6v6"/><path d="M5.6 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 12-3"/></>,
    paymentEvent: <><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h5M8 16h8"/><circle cx="17" cy="12" r="1"/></>,
    compliance: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m8 12 2.5 2.5L16 9"/></>,
    securityEvent: <><path d="M12 3 2.8 19h18.4z"/><path d="M12 9v4M12 16h.01"/><path d="M18 5h3v3"/></>,
    infrastructure: <><path d="M4 21V9l8-6 8 6v12M2 21h20M9 21v-6h6v6M8 10h.01M16 10h.01"/></>,
    flag: <><path d="M5 21V4M5 5h13l-2 4 2 4H5"/></>,
    integration: <><path d="M8 8V4h8v4M8 16v4h8v-4M4 8h4v8H4zM16 8h4v8h-4zM8 12h8"/></>,
    backup: <><path d="M4 7a8 8 0 1 1-1 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    platformSettings: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M2 10h4M10 8h4M18 12h4M18 16h4"/></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13H3v5h4v-5zM20 13h1v5h-4v-5zM17 20a5 5 0 0 1-5 2"/></>,
    announcement: <><path d="m3 11 18-5v12L3 13z"/><path d="M7 14l2 7h4l-2-6M21 10l2-1M21 16l2 1"/></>,
    status: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    device: <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4M9 5h6"/><circle cx="12" cy="14" r="2"/></>,
    sync: <><path d="M20 7h-6V1M4 17h6v6"/><path d="M5 9a7 7 0 0 1 12-3l3 1M4 17l3 1a7 7 0 0 0 12-3"/></>,
    securityCenter: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4l3 2"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const navigationGroups = [
  { label: 'Workspace', icon: 'layout' as IconName, items: [{ to: '/admin', label: 'Platform Pulse', icon: 'overview' as IconName }] },
  { label: 'Operations', icon: 'workflow' as IconName, items: [
    { to: '/admin/transactions', label: 'Transactions', icon: 'receipt' as IconName },
    { to: '/admin/sync-health', label: 'Sync Health', icon: 'sync' as IconName },
    { to: '/admin/devices', label: 'Devices', icon: 'device' as IconName },
    { to: '/admin/webhooks', label: 'Webhooks', icon: 'webhook' as IconName },
    { to: '/admin/jobs', label: 'Background Jobs', icon: 'clock' as IconName },
    { to: '/admin/incidents', label: 'Incidents', icon: 'alert' as IconName, badge: '3' },
  ] },
  { label: 'Tenants', icon: 'buildings' as IconName, items: [
    { to: '/admin/tenants', label: 'Tenant Registry', icon: 'tenants' as IconName },
    { to: '/admin/tenant-health', label: 'Tenant Health', icon: 'tenantHealth' as IconName },
  ] },
  { label: 'Identity & Access', icon: 'key' as IconName, items: [
    { to: '/admin/identity', label: 'Users & Roles', icon: 'user' as IconName },
    { to: '/admin/roles', label: 'Permissions', icon: 'role' as IconName },
    { to: '/admin/sessions', label: 'Sessions', icon: 'sessions' as IconName },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: 'audit' as IconName },
  ] },
  { label: 'Billing', icon: 'wallet' as IconName, items: [
    { to: '/admin/subscriptions', label: 'Subscriptions', icon: 'subscription' as IconName },
    { to: '/admin/invoices', label: 'Invoices', icon: 'invoice' as IconName },
    { to: '/admin/billing-payments', label: 'Billing Payments', icon: 'billingPayment' as IconName },
    { to: '/admin/revenue', label: 'Revenue', icon: 'revenue' as IconName },
    { to: '/admin/licenses', label: 'Licenses', icon: 'license' as IconName },
  ] },
  { label: 'Payments', icon: 'payment' as IconName, items: [
    { to: '/admin/mpesa', label: 'M-PESA Operations', icon: 'mpesa' as IconName, badge: '8' },
    { to: '/admin/reconciliation', label: 'Reconciliation', icon: 'reconcile' as IconName },
    { to: '/admin/payment-events', label: 'Payment Events', icon: 'paymentEvent' as IconName },
  ] },
  { label: 'Security & Compliance', icon: 'shield' as IconName, items: [
    { to: '/admin/security', label: 'Security Center', icon: 'securityCenter' as IconName },
    { to: '/admin/compliance', label: 'Compliance', icon: 'compliance' as IconName },
    { to: '/admin/security-events', label: 'Security Events', icon: 'securityEvent' as IconName },
  ] },
  { label: 'Platform', icon: 'server' as IconName, items: [
    { to: '/admin/infrastructure', label: 'Infrastructure', icon: 'infrastructure' as IconName },
    { to: '/admin/feature-flags', label: 'Feature Flags', icon: 'flag' as IconName },
    { to: '/admin/integrations', label: 'Integrations', icon: 'integration' as IconName },
    { to: '/admin/notifications', label: 'Notifications', icon: 'bell' as IconName },
    { to: '/admin/backups', label: 'Backups', icon: 'backup' as IconName },
    { to: '/admin/system-settings', label: 'Tenant Settings Registry', icon: 'platformSettings' as IconName },
  ] },
  { label: 'Support', icon: 'lifeBuoy' as IconName, items: [
    { to: '/admin/support', label: 'Support Center', icon: 'support' as IconName, badge: '3' },
    { to: '/admin/announcements', label: 'Announcements', icon: 'announcement' as IconName },
    { to: '/admin/system-status', label: 'System Status', icon: 'status' as IconName },
  ] },
]

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

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { theme, isDark, setTheme } = useTheme()
  const pathname = usePathname() ?? '/admin'
  const slug = pathname.split('/').filter(Boolean).at(-1) ?? 'admin'
  const readableSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
  const meta = adminPageMeta[pathname] ?? { eyebrow: 'Control plane', title: readableSlug, description: 'Platform-wide operations and administrative controls.' }
  const [quickOpen, setQuickOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const matchingNavigationGroups = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    return navigationGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          !query || `${item.label} ${item.to}`.toLowerCase().includes(query),
        ),
      }))
      .filter(group => group.items.length > 0)
  }, [commandQuery])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(value => !value)
        setCommandQuery('')
      } else if (event.key === 'Escape') {
        setCommandOpen(false)
        setNotificationsOpen(false)
        setQuickOpen(false)
        setThemeMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={`admin-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} data-theme={isDark ? 'dark' : 'light'}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark"><img src="/mobiduka_icon.svg" alt=""/></div>
          <div className="admin-brand-copy">
            <strong>MobiDuka</strong>
            <span>POS</span>
          </div>
          <button className="admin-sidebar-toggle" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? '›' : '‹'}</button>
        </div>

        <nav className="admin-nav admin-nav-scroll" aria-label="Admin navigation">
          {navigationGroups.map(group => {
            const expanded = collapsedGroups[group.label] !== true
            return <section className="admin-nav-group" key={group.label}>
              <button className="admin-nav-group-trigger" aria-label={group.label} title={sidebarCollapsed ? group.label : undefined} aria-expanded={expanded} onClick={() => setCollapsedGroups(current => ({ ...current, [group.label]: expanded }))}>
                <AdminIcon name={group.icon} size={13}/><span>{group.label}</span><AdminIcon name="chevron" size={12}/>
              </button>
              {expanded && group.items.map(item => (
                <Link key={item.to} href={item.to} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} aria-current={pathname === item.to ? 'page' : undefined} className={`admin-nav-item${(item.to === '/admin' ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)) ? ' active' : ''}`}>
                  <AdminIcon name={item.icon} />
                  <span>{item.label}</span>
                  {'badge' in item && item.badge && <b>{item.badge}</b>}
                </Link>
              ))}
            </section>
          })}
        </nav>

        <div className="admin-sidebar-spacer" />
        <div className="admin-system-card">
          <div className="admin-system-top">
            <span className="admin-live-dot" />
            <span>Health feed not connected</span>
          </div>
          <div className="admin-system-stats">
            <span>Live status unavailable</span>
          </div>
        </div>
        <a className="admin-back-link" href="/app">
          <AdminIcon name="external" size={15} />
          Open POS app
        </a>
        <a className="admin-back-link" href="/admin2">
          <AdminIcon name="layout" size={15} />
          Switch to Admin2
        </a>
        <div className="admin-profile">
          <div className="admin-avatar">PA</div>
          <div>
            <strong>Platform administrator</strong>
            <span>SUPER_ADMIN</span>
          </div>
          <button className="admin-icon-button" aria-label="Admin settings"><AdminIcon name="settings" size={16} /></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-breadcrumbs">
              <Link href="/admin">MobiDuka</Link>
              <AdminIcon name="chevron" size={10}/>
              <strong>{meta.title}</strong>
            </div>
            <div className="admin-eyebrow">{meta.eyebrow}</div>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-popover-anchor">
              <button
                className={`admin-theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
                onClick={() => setThemeMenuOpen(value => !value)}
                aria-label="Choose color theme"
                aria-expanded={themeMenuOpen}
                aria-haspopup="menu"
                title="Choose color theme"
              >
                <AdminIcon name={theme === 'auto' ? 'monitor' : isDark ? 'sun' : 'moon'} size={17}/>
              </button>
              {themeMenuOpen && (
                <div className="admin-theme-menu" role="menu" aria-label="Color theme">
                  {(['light', 'dark', 'auto'] as const).map(mode => (
                    <button key={mode} role="menuitemradio" aria-checked={theme === mode} className={theme === mode ? 'active' : ''} onClick={() => { setTheme(mode); setThemeMenuOpen(false) }}>
                      <AdminIcon name={mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor'} size={15}/>
                      <span>{mode === 'auto' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}</span>
                      {theme === mode && <AdminIcon name="check" size={14}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-global-search">
              <AdminIcon name="search" size={16} />
              <input
                aria-label="Search control plane"
                placeholder="Search workspaces…"
                readOnly
                title="Open workspace search"
                onClick={() => {
                  setCommandOpen(true)
                  setCommandQuery('')
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="admin-popover-anchor">
              <button type="button" className="admin-icon-button has-alert" onClick={() => setNotificationsOpen(value => !value)} aria-label="Notifications" aria-expanded={notificationsOpen}><AdminIcon name="bell" size={16}/></button>
              {notificationsOpen && (
                <div className="admin-notifications-popover">
                  <div className="admin-popover-head"><div><span>INFRASTRUCTURE LOGS</span><strong>Notifications</strong></div><button className="admin-icon-button" onClick={() => setNotificationsOpen(false)}><AdminIcon name="close" size={14}/></button></div>
                  <div className="admin-notification"><div><strong>Admin notifications are not connected</strong><span>No notification feed is currently available from the backend.</span></div></div>
                </div>
              )}
            </div>
            <div className="admin-popover-anchor">
              <button className="admin-primary-button" onClick={() => setQuickOpen(value => !value)}><span>+</span> Quick access</button>
              {quickOpen && (
                <div className="admin-quick-menu">
                  <Link href="/admin/tenants" onClick={() => setQuickOpen(false)}><AdminIcon name="tenants" size={16}/><div><strong>Tenant registry</strong><span>View database businesses</span></div></Link>
                  <Link href="/admin/identity" onClick={() => setQuickOpen(false)}><AdminIcon name="identity" size={16}/><div><strong>User identities</strong><span>View database users</span></div></Link>
                  <Link href="/admin/licenses" onClick={() => setQuickOpen(false)}><AdminIcon name="licenses" size={16}/><div><strong>Manage licenses</strong><span>View trials, plans and enforcement</span></div></Link>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>
      {commandOpen && (
        <div
          className="admin-command-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setCommandOpen(false)
          }}
        >
          <div className="admin-command-palette" role="dialog" aria-modal="true" aria-label="Search admin workspaces">
            <div className="admin-command-input">
              <AdminIcon name="search" size={17}/>
              <input
                autoFocus
                value={commandQuery}
                onChange={event => setCommandQuery(event.target.value)}
                placeholder="Search admin pages…"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="admin-command-results">
              {matchingNavigationGroups.length ? matchingNavigationGroups.map(group => (
                <section key={group.label}>
                  <span>{group.label}</span>
                  {group.items.map(item => (
                    <Link
                      key={item.to}
                      href={item.to}
                      onClick={() => setCommandOpen(false)}
                    >
                      <div className="admin-command-result-icon"><AdminIcon name={item.icon} size={14}/></div>
                      <div><strong>{item.label}</strong><small>{item.to}</small></div>
                      <AdminIcon name="chevron" size={12}/>
                    </Link>
                  ))}
                </section>
              )) : (
                <div className="admin-command-empty">
                  <strong>No matching admin pages</strong>
                  <span>Try a workspace name such as tenants, devices, or licenses.</span>
                </div>
              )}
            </div>
            <div className="admin-command-footer">
              <span>Enter to open</span>
              <span>Esc to close</span>
              <strong>MobiDuka Control Plane</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminDataProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminDataProvider>
  )
}

export function AdminOverview() {
  const { period, setPeriod, monitorOpen, setMonitorOpen } = useAdminData()
  const chartData = useMemo(() => overviewTrendData.map((point, index) => ({
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

export function AdminInfrastructure() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>(initialSyncConflicts)
  const [broadcast, setBroadcast] = useState({ target: 'All Cashier Terminals', title: 'Scheduled Daraja Maintenance', message: 'Service Alert: Safaricom Daraja core ledger maintenance tonight from 11:59 PM EAT.' })
  const [broadcastStatus, setBroadcastStatus] = useState('')
  const [cron, setCron] = useState({ running: false, last: 'Today, 06:00 AM', next: 'Tomorrow, 06:00 AM', duration: '142ms' })
  const [deviceOpen, setDeviceOpen] = useState(true)
  const [deviceConfirm, setDeviceConfirm] = useState(false)
  const [apiToken, setApiToken] = useState('')
  const [sentryEvents, setSentryEvents] = useState(initialInfrastructureSentryEvents)
  const [expenses, setExpenses] = useState<ExpenseAudit[]>(initialExpenseAudits)
  const [orders, setOrders] = useState<ProcurementOrder[]>(initialProcurementOrders)

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
      <div className="admin-empty-state" role="note">
        Infrastructure telemetry and controls are sample-only in this build. No displayed metrics are read from the database, and actions do not change backend records.
      </div>
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

export function AdminLicenses() {
  type LegacyLicenseRecord = {
    id: string
    businessId: string
    licenseType: string
    deviceLimit: number
    expiryDate: string
    status: string
    createdAt: string
    business: { name: string; ownerName: string | null; email: string | null }
  }
  type SubscriptionRecord = {
    id: string
    businessId: string
    planType: string
    status: string
    trialEndsAt: string | null
    currentPeriodEndsAt: string | null
    graceEndsAt: string | null
    licenseCost: number
    autoRenewActive: boolean
    business: { id: string; name: string; ownerName: string | null; email: string | null }
  }
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [legacyLicenses, setLegacyLicenses] = useState<LegacyLicenseRecord[]>([])
  const [legacyLicenseCount, setLegacyLicenseCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const refreshSubscriptions = async () => {
    const response = await fetch('/api/admin/licenses', { cache: 'no-store' })
    const result = await response.json() as {
      subscriptions?: SubscriptionRecord[]
      legacyLicenses?: LegacyLicenseRecord[]
      legacyLicenseCount?: number
      error?: string
    }
    if (!response.ok) throw new Error(result.error ?? 'Unable to load subscriptions.')
    setSubscriptions(result.subscriptions ?? [])
    setLegacyLicenses(result.legacyLicenses ?? [])
    setLegacyLicenseCount(result.legacyLicenseCount ?? 0)
  }

  useEffect(() => {
    void refreshSubscriptions()
      .catch(error => setLoadError(error instanceof Error ? error.message : 'Unable to load subscriptions.'))
      .finally(() => setLoading(false))
  }, [])

  const updateSubscription = async (subscription: SubscriptionRecord, action: 'ACTIVATE' | 'RENEW' | 'REVOKE' | 'AUTO_RENEW') => {
    setActionError('')
    setPendingId(subscription.id)
    try {
      const response = await fetch('/api/admin/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          subscriptionId: subscription.id,
          planType: subscription.planType,
          durationDays: 30,
          ...(action === 'AUTO_RENEW' ? { autoRenewActive: !subscription.autoRenewActive } : {}),
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Unable to update subscription.')
      await refreshSubscriptions()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update subscription.')
    } finally {
      setPendingId(null)
    }
  }

  const trialCount = subscriptions.filter(subscription => subscription.status === 'TRIAL').length
  const activeCount = subscriptions.filter(subscription => subscription.status === 'ACTIVE').length
  const attentionCount = subscriptions.filter(subscription => ['GRACE', 'EXPIRED', 'REVOKED'].includes(subscription.status)).length

  return (
    <div className="admin-page-stack">
      <PlanCatalogEditor />
      <PlatformPaymentLedger />
      <section className="admin-license-metrics">
        <div><span>Businesses with subscriptions</span><strong>{subscriptions.length}</strong><small>Current platform records</small></div>
        <div><span>Active subscriptions</span><strong>{activeCount}</strong><small>Paid period in effect</small></div>
        <div><span>14-day trials</span><strong>{trialCount}</strong><small>Trial access running</small></div>
        <div><span>Requires attention</span><strong>{attentionCount}</strong><small>Grace, expired, or revoked</small></div>
      </section>

      <div className="admin-table-panel">
        <div className="admin-table-title-row"><div><span>Subscription ledger</span><h2>Contracts & enforcement</h2></div><div><button className="admin-secondary-button" onClick={() => downloadCsv('mobiduka-subscriptions.csv', subscriptions.map(subscription => ({
          SubscriptionID: subscription.id, BusinessID: subscription.businessId, Business: subscription.business.name,
          Plan: subscription.planType, Status: subscription.status, TrialEndsAt: subscription.trialEndsAt ?? '',
          PeriodEndsAt: subscription.currentPeriodEndsAt ?? '', GraceEndsAt: subscription.graceEndsAt ?? '',
          MonthlyValueKSh: subscription.licenseCost, AutoRenew: subscription.autoRenewActive,
        })))}>Export Subscription Ledger</button><button className="admin-secondary-button" onClick={() => void refreshSubscriptions().catch(error => setLoadError(error instanceof Error ? error.message : 'Unable to reload subscriptions.'))}>Refresh</button></div></div>
        {loadError && <div className="admin-empty-state" role="alert">{loadError}</div>}
        {actionError && <div className="admin-empty-state" role="alert">{actionError}</div>}
        <div className="admin-table-scroll">
          <table className="admin-table license-table">
            <thead><tr><th>Business</th><th>Plan</th><th>Trial / period end</th><th>Monthly price</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={6}>Loading subscription records…</td></tr> : subscriptions.length === 0 ? <tr><td colSpan={6}>No subscriptions have been provisioned.</td></tr> : subscriptions.map(subscription => {
              const expiresAt = subscription.status === 'TRIAL' ? subscription.trialEndsAt : subscription.status === 'GRACE' ? subscription.graceEndsAt : subscription.currentPeriodEndsAt
              const locked = ['EXPIRED', 'REVOKED'].includes(subscription.status)
              return (
                <tr key={subscription.id}>
                  <td><div className="admin-person-cell"><strong>{subscription.business.name}</strong><span>{subscription.business.ownerName ?? subscription.business.email ?? subscription.businessId}</span></div></td>
                  <td><span className={`admin-plan-badge ${subscription.planType.toLowerCase()}`}>{subscription.planType}</span></td>
                  <td><strong>{expiresAt ? new Date(expiresAt).toLocaleDateString('en-KE') : '—'}</strong><span className="admin-countdown">{subscription.status === 'TRIAL' ? 'Trial ends' : subscription.status === 'GRACE' ? 'Grace ends' : 'Current period ends'}</span></td>
                  <td><strong className="admin-mono">KSh {subscription.licenseCost.toLocaleString()}</strong></td>
                  <td><span className={`admin-status-badge ${locked ? 'suspended' : subscription.status === 'GRACE' ? 'warning' : 'active'}`}><i/>{subscription.status}</span></td>
                  <td><div className="admin-row-actions">
                    <button className="admin-row-button" disabled={pendingId === subscription.id} onClick={() => void updateSubscription(subscription, locked ? 'ACTIVATE' : 'RENEW')}>{pendingId === subscription.id ? 'Saving…' : locked ? 'Activate 30 days' : 'Renew 30 days'}</button>
                    <button className="admin-row-button" disabled={pendingId === subscription.id} onClick={() => void updateSubscription(subscription, 'AUTO_RENEW')}>{subscription.autoRenewActive ? 'Disable auto-renew' : 'Enable auto-renew'}</button>
                    {!locked && <button className="admin-danger-button" disabled={pendingId === subscription.id} onClick={() => {
                      if (window.confirm(`Revoke subscription access for ${subscription.business.name}?`)) void updateSubscription(subscription, 'REVOKE')
                    }}>Revoke</button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </div>
      <div className="admin-table-panel">
        <div className="admin-table-title-row">
          <div><span>Legacy device licenses</span><h2>Separate license records</h2></div>
          <span>Latest {legacyLicenses.length} of {legacyLicenseCount} records · license keys are never returned</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table license-table">
            <thead><tr><th>Business</th><th>License type</th><th>Device limit</th><th>Expires</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {legacyLicenses.map(license => (
                <tr key={license.id}>
                  <td><div className="admin-person-cell"><strong>{license.business.name}</strong><span>{license.business.ownerName ?? license.business.email ?? license.businessId}</span></div></td>
                  <td>{license.licenseType}</td>
                  <td>{license.deviceLimit}</td>
                  <td>{new Date(license.expiryDate).toLocaleDateString('en-KE')}</td>
                  <td><span className={`admin-status-badge ${license.status.toLowerCase() === 'active' ? 'active' : 'suspended'}`}><i/>{license.status}</span></td>
                  <td>{new Date(license.createdAt).toLocaleDateString('en-KE')}</td>
                </tr>
              ))}
              {!loading && legacyLicenses.length === 0 && <tr><td colSpan={6}>No legacy device-license rows have been recorded.</td></tr>}
              {loading && legacyLicenses.length === 0 && <tr><td colSpan={6}>Loading legacy license records…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminNotFound() {
  return <div className="admin-empty-state"><AdminIcon name="warning" size={34}/><h2>Admin page unavailable</h2><p>The requested control-plane route does not exist.</p><Link href="/admin">Return to overview</Link></div>
}
