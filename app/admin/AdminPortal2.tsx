"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { planCatalog } from "@/app/plans/plan-catalog"
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
} from "recharts"
import "./admin.css"

type AdminPageData = {
  total: number
  page: number
  pageSize: number
}

type AdminOverviewData = {
  metrics: {
    businesses: number
    users: number
    activeDevices: number
    completedSales30d: number
    salesVolume30d: number
    activeSubscriptions: number
    trialSubscriptions: number
    attentionSubscriptions: number
  }
  recentMpesaTransactions: Array<{
    id: string
    checkoutRequestId: string
    amount: number
    status: string
    createdAt: string
    businessName: string
    currency: string | null
  }>
  trend: Array<{
    day: string
    completedSales: number
    businessesCreated: number
  }>
  generatedAt: string
}

type AdminBusiness = {
  id: string
  name: string
  branch: string | null
  ownerName: string | null
  email: string | null
  phone: string | null
  status: string
  createdAt: string
  _count: {
    users: number
    devices: number
  }
  subscription: {
    planType: string
    status: string
    trialEndsAt: string | null
    currentPeriodEndsAt: string | null
    graceEndsAt: string | null
  } | null
  latestLicense: {
    licenseType: string
    status: string
    expiryDate: string
    deviceLimit: number
  } | null
  mpesaIntegrations: Array<{
    environment: string
    accountType: string
    shortcode: string
    partyB: string | null
  }>
}

type AdminTenantsData = AdminPageData & {
  businesses: AdminBusiness[]
  statusCounts: Record<string, number>
  subscriptionStatusCounts: Record<string, number>
  legacyLicenseCount: number
}

type AdminUserRecord = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string
  role: string
  business: {
    id: string
    name: string
    branch: string | null
  }
  deviceCount: number
  lastSeen: string | null
  createdAt: string
}

type AdminIdentityData = AdminPageData & {
  users: AdminUserRecord[]
  roleCounts: Array<{
    role: string
    count: number
  }>
}

type AdminLicenseData = {
  subscriptions: Array<{
    id: string
    businessId: string
    planType: string
    status: string
    trialEndsAt: string | null
    currentPeriodEndsAt: string | null
    graceEndsAt: string | null
    licenseCost: number
    autoRenewActive: boolean
    business: {
      id: string
      name: string
      ownerName: string | null
      email: string | null
      status: string
    }
  }>
  legacyLicenses: Array<{
    id: string
    businessId: string
    licenseType: string
    deviceLimit: number
    expiryDate: string
    status: string
    createdAt: string
    business: {
      name: string
      ownerName: string | null
      email: string | null
    }
  }>
  legacyLicenseCount: number
}

async function adminApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  const result = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(result.error ?? "Unable to load platform data.")
  }
  return result
}

function useAdminApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setData(null)
    void adminApi<T>(url, { signal: controller.signal })
      .then(setData)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load platform data.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [url, revision])

  return {
    data,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  }
}

type IconName = "grid" | "building" | "shield" | "key" | "server" | "receipt" | "sync" | "device" | "webhook" | "job" | "alert" | "card" | "lock" | "flag" | "cloud" | "support" | "search" | "bell" | "plus" | "chevron" | "check" | "trend" | "users" | "wallet" | "activity" | "close"

interface IconProps {
  name: IconName
  size?: number
}

function Icon({ name, size = 16 }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2M2 21h20" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="5" />
        <path d="m12 11 8-8M17 6l3 3M14 9l2 2" />
      </>
    ),
    server: (
      <>
        <rect x="3" y="3" width="18" height="7" rx="2" />
        <rect x="3" y="14" width="18" height="7" rx="2" />
        <path d="M7 6.5h.01M7 17.5h.01" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>
    ),
    sync: (
      <>
        <path d="M20 7h-5V2M4 17h5v5" />
        <path d="M5.5 9A8 8 0 0 1 19 5l1 2M18.5 15A8 8 0 0 1 5 19l-1-2" />
      </>
    ),
    device: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 18h4" />
      </>
    ),
    webhook: (
      <>
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M10 8 7 14M14 8l3 6M8 17h8" />
      </>
    ),
    job: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h5M8 17h3" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4M5 4h12l-2 4 2 4H5" />
      </>
    ),
    cloud: (
      <>
        <path d="M17.5 19H7a5 5 0 1 1 1-9.9A7 7 0 0 1 21 12a4 4 0 0 1-3.5 7Z" />
      </>
    ),
    support: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 9a4 4 0 1 1 6 3.5c-1 .6-2 1.1-2 2.5M12 18h.01" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M14 21h-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    trend: (
      <>
        <path d="m3 17 6-6 4 4 8-9" />
        <path d="M15 6h6v6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

type NavItem = {
  to: string
  label: string
  icon: IconName
  badge?: string
  end?: boolean
}
interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Command",
    items: [
      { to: "/admin", label: "Platform Overview", icon: "grid", end: true },
      { to: "/admin/tenants", label: "Tenant Registry", icon: "building" },
      { to: "/admin/identity", label: "Identity & RBAC", icon: "shield" },
      { to: "/admin/licenses", label: "Licenses", icon: "key" },
      { to: "/admin/tenant-health", label: "Tenant Health", icon: "activity" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/transactions", label: "Transactions", icon: "receipt" },
      {
        to: "/admin/sync-health",
        label: "Sync Control",
        icon: "sync",
        badge: "18",
      },
      { to: "/admin/devices", label: "Device Fleet", icon: "device" },
      { to: "/admin/webhooks", label: "API & Webhooks", icon: "webhook" },
      { to: "/admin/jobs", label: "Background Jobs", icon: "job" },
      { to: "/admin/incidents", label: "Incident Center", icon: "alert" },
      {
        to: "/admin/mpesa",
        label: "M-PESA Operations",
        icon: "card",
        badge: "4",
      },
      {
        to: "/admin/reconciliation",
        label: "Reconciliation",
        icon: "activity",
      },
      { to: "/admin/payment-events", label: "Payment Events", icon: "card" },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/admin/subscriptions", label: "Subscriptions", icon: "wallet" },
      { to: "/admin/invoices", label: "Invoices", icon: "receipt" },
      {
        to: "/admin/billing-payments",
        label: "Billing Payments",
        icon: "card",
      },
      { to: "/admin/revenue", label: "Revenue", icon: "trend" },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/admin/security", label: "Security Center", icon: "lock" },
      { to: "/admin/compliance", label: "Compliance", icon: "shield" },
      { to: "/admin/security-events", label: "Security Events", icon: "alert" },
      { to: "/admin/roles", label: "Roles & Permissions", icon: "key" },
      { to: "/admin/sessions", label: "Sessions", icon: "device" },
      { to: "/admin/audit-logs", label: "Audit Ledger", icon: "receipt" },
      { to: "/admin/feature-flags", label: "Feature Flags", icon: "flag" },
      { to: "/admin/backups", label: "Data & Recovery", icon: "cloud" },
    ],
  },
  {
    label: "Platform & Support",
    items: [
      { to: "/admin/infrastructure", label: "Infrastructure", icon: "server" },
      { to: "/admin/integrations", label: "Integrations", icon: "webhook" },
      { to: "/admin/notifications", label: "Notifications", icon: "bell" },
      { to: "/admin/system-settings", label: "Tenant Settings", icon: "key" },
      {
        to: "/admin/support",
        label: "Support Center",
        icon: "support",
        badge: "3",
      },
      { to: "/admin/announcements", label: "Announcements", icon: "alert" },
      { to: "/admin/system-status", label: "System Status", icon: "activity" },
    ],
  },
]

const routeMeta: Record<string, [string, string, string]> = {
  "/admin": [
    "PLATFORM PULSE",
    "Global Platform Overview",
    "Database-backed business, subscription, sales, and M-PESA summary data.",
  ],
  "/admin/tenants": [
    "TENANT OPERATIONS",
    "Tenant & Business Registry",
    "Browse registered businesses and their subscription, license, user, and device records.",
  ],
  "/admin/identity": [
    "IDENTITY & ACCESS",
    "Granular IAM & RBAC Control",
    "Browse registered users, assigned roles, linked businesses, and device activity.",
  ],
  "/admin/licenses": [
    "MONETIZATION",
    "License Management",
    "Review subscription and legacy device-license records and supported renewal controls.",
  ],
  "/admin/infrastructure": [
    "PLATFORM ENGINEERING",
    "Infrastructure Command",
    "Infrastructure telemetry and controls are sample-only and are not connected to backend services.",
  ],
}

function admin2Href(path: string) {
  return path.replace(/^\/admin(?=\/|$)/, "/admin2")
}

function titleFor(pathname: string) {
  const adminPath = pathname.replace(/^\/admin2(?=\/|$)/, "/admin")
  if (routeMeta[adminPath]) return routeMeta[adminPath]
  const item = navGroups
    .flatMap((group) => group.items)
    .find((entry) => admin2Href(entry.to) === pathname)
  return [
    "CONTROL PLANE",
    item?.label ?? "Platform Operations",
    "Operational records and administrative controls.",
  ]
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin"
  const [collapsed, setCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [eyebrow, title, description] = titleFor(pathname)
  const matches = useMemo(() => {
    const value = query.toLowerCase().trim()
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !value || item.label.toLowerCase().includes(value),
        ),
      }))
      .filter((group) => group.items.length)
  }, [query])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
      if (event.key === "Escape") {
        setCommandOpen(false)
        setNotificationsOpen(false)
        setQuickOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className={`admin-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">M</div>
          <div className="admin-brand-copy">
            <strong>MobiDuka</strong>
            <span>Control Plane</span>
          </div>
          <button
            className="admin-sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label="Toggle sidebar"
          >
            <Icon name="server" size={13} />
          </button>
        </div>
        <div className="admin-nav-scroll">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <button className="admin-nav-group-trigger">
                <span>{group.label}</span>
                <Icon name="chevron" size={11} />
              </button>
              <nav className="admin-nav">
                {group.items.map((item) => {
                  const href = admin2Href(item.to)
                  const active = item.end
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`)
                  return (
                    <Link
                      key={item.to}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`admin-nav-item ${active ? "active" : ""}`}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {item.badge ? (
                        <b>{item.badge}</b>
                      ) : (
                        <Icon name="chevron" size={11} />
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className="admin-system-card">
          <div className="admin-system-top">
            <i className="admin-live-dot" />
            <span>Health feed unavailable</span>
          </div>
          <div className="admin-system-stats">
            <span>Service telemetry is not connected</span>
          </div>
        </div>
        <Link href="/desktop" className="admin-back-link">
          Open store desktop <Icon name="chevron" size={11} />
        </Link>
        <div className="admin-profile">
          <div className="admin-avatar">PA</div>
          <div>
            <strong>Platform administrator</strong>
            <span>SUPER_ADMIN</span>
          </div>
          <button className="admin-icon-button">
            <Icon name="chevron" size={12} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-breadcrumbs">
              <Link href="/admin2">MobiDuka</Link>
              <Icon name="chevron" size={10} />
              <strong>{title}</strong>
            </div>
            <div className="admin-eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="admin-topbar-actions">
            <button
              className="admin-global-search admin-command-button"
              onClick={() => setCommandOpen(true)}
            >
              <Icon name="search" />
              <span>Search control plane</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="admin-health-pill">
              <i className="admin-live-dot" /> HEALTH UNAVAILABLE
            </span>
            <div className="admin-popover-anchor">
              <button
                className="admin-icon-button has-alert"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Notifications"
              >
                <Icon name="bell" />
              </button>
              {notificationsOpen && (
                <div className="admin-notifications-popover">
                  <div className="admin-popover-head">
                    <div>
                      <span>PLATFORM ALERTS</span>
                      <strong>Feed unavailable</strong>
                    </div>
                  </div>
                  <div className="admin-notification">
                    <Icon name="bell" />
                    <div>
                      <strong>Admin notifications are not connected</strong>
                      <span>
                        No notification feed is currently available from the
                        backend.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-popover-anchor">
              <button
                className="admin-primary-button"
                onClick={() => setQuickOpen((value) => !value)}
              >
                <Icon name="plus" size={14} /> Quick action
              </button>
              {quickOpen && (
                <div className="admin-quick-menu">
                  {[
                    ["building", "Tenant registry", "View businesses"],
                    ["key", "Licenses", "Review subscriptions and licenses"],
                    ["alert", "Incidents", "Open incident workspace"],
                  ].map((item) => (
                    <Link
                      key={item[1]}
                      href={admin2Href(
                        item[1] === "Tenant registry"
                          ? "/admin/tenants"
                          : item[1] === "Licenses"
                            ? "/admin/licenses"
                            : "/admin/incidents",
                      )}
                      onClick={() => setQuickOpen(false)}
                    >
                      <Icon name={item[0] as IconName} />
                      <div>
                        <strong>{item[1]}</strong>
                        <span>{item[2]}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              className="admin-top-avatar"
              aria-label="Platform administrator"
            >
              PA
            </button>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>

      {commandOpen && (
        <div
          className="admin-command-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCommandOpen(false)
          }}
        >
          <div className="admin-command-palette">
            <div className="admin-command-input">
              <Icon name="search" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages, tenants, transactions, and controls…"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="admin-command-results">
              {matches.map((group) => (
                <section key={group.label}>
                  <span>{group.label}</span>
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      href={admin2Href(item.to)}
                      onClick={() => setCommandOpen(false)}
                    >
                      <div className="admin-command-result-icon">
                        <Icon name={item.icon} size={14} />
                      </div>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.to}</small>
                      </div>
                      <Icon name="chevron" size={12} />
                    </Link>
                  ))}
                </section>
              ))}
            </div>
            <div className="admin-command-footer">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <strong>MobiDuka Command</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminOverview() {
  const [period, setPeriod] = useState("30D")
  const [monitorOpen, setMonitorOpen] = useState(false)
  const { data, loading, error, refresh } = useAdminApi<AdminOverviewData>(
    "/api/admin/overview",
  )
  const stream = (data?.recentMpesaTransactions ?? []).map((transaction) => {
    const status = transaction.status.toLowerCase()
    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(transaction.createdAt).getTime()) / 1000,
      ),
    )
    return {
      store: transaction.businessName,
      ref: transaction.checkoutRequestId || transaction.id,
      amount: `${transaction.currency ?? "Amount"} ${Number(transaction.amount).toLocaleString()}`,
      status: ["success", "completed", "paid"].includes(status)
        ? "complete"
        : ["pending", "processing", "initiated", "submitted"].includes(status)
          ? "pending"
          : "failed",
      seconds: elapsedSeconds,
    }
  })
  const metrics = data
    ? [
        [
          "building",
          "Registered businesses",
          data.metrics.businesses.toLocaleString(),
          "Database records",
          "blue",
        ],
        [
          "activity",
          "Completed sales · 30 days",
          data.metrics.completedSales30d.toLocaleString(),
          "Completed sale records",
          "green",
        ],
        [
          "wallet",
          "Sales amount · 30 days",
          data.metrics.salesVolume30d.toLocaleString(),
          "Stored total · currency not normalized",
          "gold",
        ],
        [
          "trend",
          "Subscriptions needing attention",
          data.metrics.attentionSubscriptions.toLocaleString(),
          "Expired, grace, or revoked",
          "violet",
        ],
      ] as const
    : []
  const healthMetrics = data
    ? [
        [
          "blue",
          "Active registered devices",
          data.metrics.activeDevices.toLocaleString(),
          "Device records marked active",
        ],
        [
          "green",
          "Active subscriptions",
          data.metrics.activeSubscriptions.toLocaleString(),
          "Current subscription records",
        ],
        [
          "gold",
          "Trial subscriptions",
          data.metrics.trialSubscriptions.toLocaleString(),
          "Current subscription records",
        ],
        [
          "violet",
          "Platform users",
          data.metrics.users.toLocaleString(),
          "Registered user records",
        ],
      ] as const
    : []
  const pendingTransactions = stream.filter(
    (row) => row.status === "pending",
  ).length

  return (
    <div className="admin-page-stack">
      <div className="admin-section-head">
        <div className="admin-overview-controls">
          <div className="admin-date-filter">
            <i className="admin-live-dot" /> DATABASE SNAPSHOT ·{" "}
            {data
              ? new Date(data.generatedAt).toLocaleString()
              : loading
                ? "LOADING"
                : "UNAVAILABLE"}
          </div>
          <button className="admin-secondary-button" onClick={refresh}>
            Refresh data
          </button>
        </div>
        <div className="admin-period-control">
          {["24H", "7D", "30D", "90D"].map((value) => (
            <button
              key={value}
              className={period === value ? "active" : ""}
              disabled={value !== "30D"}
              onClick={() => setPeriod(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <section className="admin-metric-grid">
        {loading &&
          !data &&
          Array.from({ length: 4 }, (_, index) => (
            <article className="admin-metric-card" key={`loading-${index}`}>
              <span className="admin-metric-label">Loading live data…</span>
            </article>
          ))}
        {metrics.map((metric) => (
          <article className="admin-metric-card" key={metric[1]}>
            <div className={`admin-metric-icon ${metric[4]}`}>
              <Icon name={metric[0]} />
            </div>
            <span className="admin-metric-label">{metric[1]}</span>
            <div className="admin-metric-value">{metric[2]}</div>
            <div className="admin-metric-foot">
              <strong>{metric[3]}</strong>
              <span>· live database</span>
            </div>
          </article>
        ))}
      </section>
      {error && (
        <div className="admin-audit-result">
          <span>{error}</span>
          <button onClick={refresh}>Retry</button>
        </div>
      )}
      <section className="admin-bento-grid">
        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>30-DAY DATABASE TREND</span>
              <h2>Completed sales & business registrations</h2>
            </div>
            <div className="admin-legend">
              <span>
                <i className="volume" />
                Completed sales
              </span>
              <span>
                <i className="tenant" />
                Businesses created
              </span>
            </div>
          </div>
          <div className="admin-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend ?? []}>
                <CartesianGrid
                  stroke="rgba(255,255,255,.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#53627e"
                  axisLine={false}
                  tickLine={false}
                  fontSize={8}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#53627e"
                  axisLine={false}
                  tickLine={false}
                  fontSize={8}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#53627e"
                  axisLine={false}
                  tickLine={false}
                  fontSize={8}
                />
                <Tooltip
                  contentStyle={{
                    background: "#091326",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="completedSales"
                  stroke="#48a95a"
                  strokeWidth={2.4}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="businessesCreated"
                  stroke="#4e7fe8"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>LATEST M-PESA RECORDS</span>
              <h2>Recent payment transactions</h2>
            </div>
            <span className="admin-stream-count">
              <i className="admin-live-dot" /> {stream.length} records
            </span>
          </div>
          <div className="admin-stream-list">
            {loading && (
              <div className="admin-stream-row">Loading transaction data…</div>
            )}
            {!loading && stream.length === 0 && (
              <div className="admin-stream-row">
                No M-PESA transactions found.
              </div>
            )}
            {stream.map((row) => (
              <div className="admin-stream-row" key={row.ref}>
                <i className={`admin-stream-status ${row.status}`} />
                <div className="admin-stream-main">
                  <strong>{row.store}</strong>
                  <span>{row.ref}</span>
                </div>
                <div className="admin-stream-meta">
                  <strong>{row.amount}</strong>
                  <span className={row.status}>
                    {row.status.toUpperCase()} · {row.seconds}s
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            className="admin-text-button"
            onClick={() => setMonitorOpen(true)}
          >
            View recent transaction records <Icon name="chevron" size={11} />
          </button>
        </article>
      </section>
      <section>
        <div className="admin-section-title">
          <div>
            <span>PLATFORM HEALTH</span>
            <h2>Core service availability</h2>
          </div>
          <Link href="/admin2/system-status">
            System status <Icon name="chevron" size={11} />
          </Link>
        </div>
        <div className="admin-health-grid">
          {[...healthMetrics].map((item) => (
            <article className="admin-health-card" key={item[1]}>
              <div className={`admin-health-spark ${item[0]}`}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <span key={value} />
                ))}
              </div>
              <div>
                <span>{item[1]}</span>
                <strong>{item[2]}</strong>
                <small>{item[3]}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      {monitorOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-monitor-modal">
            <div className="admin-modal-head">
              <div>
                <span>RECENT M-PESA TRANSACTIONS</span>
                <h2>Database transaction records</h2>
                <p>Latest transactions recorded by the platform database.</p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setMonitorOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-monitor-stats">
              <div>
                <span>Active registered devices</span>
                <strong>
                  {data?.metrics.activeDevices.toLocaleString() ?? "—"}
                </strong>
                <small>Database device records</small>
              </div>
              <div>
                <span>Pending in latest records</span>
                <strong>{pendingTransactions}</strong>
                <small>Recent transaction sample</small>
              </div>
              <div>
                <span>Records shown</span>
                <strong>{stream.length}</strong>
                <small>Latest transactions returned</small>
              </div>
            </div>
            <div className="admin-monitor-list">
              {stream.map((row) => (
                <div className="admin-monitor-row" key={row.ref}>
                  <i className={`admin-runtime-icon ${row.status}`}>
                    {row.status === "complete"
                      ? "✓"
                      : row.status === "failed"
                        ? "!"
                        : "·"}
                  </i>
                  <div>
                    <strong>{row.store}</strong>
                    <span>{row.ref}</span>
                  </div>
                  <strong>{row.amount}</strong>
                  <span className={`admin-runtime-label ${row.status}`}>
                    {row.status.toUpperCase()} · {row.seconds}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Tenant = {
  id: string
  name: string
  owner: string
  email: string
  plan: string
  userCount: number
  deviceCount: number
  status: string
  mpesaIntegrations: AdminBusiness["mpesaIntegrations"]
}

export function AdminTenants() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [plan, setPlan] = useState("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [toast, setToast] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const params = new URLSearchParams({
    q: debouncedQuery,
    plan,
    page: String(page),
  })
  const { data, loading, error, refresh } = useAdminApi<AdminTenantsData>(
    `/api/admin/tenants?${params}`,
  )
  const tenants: Tenant[] = (data?.businesses ?? []).map((business) => {
    const status = business.status.toLowerCase()
    return {
      id: business.id,
      name: business.branch
        ? `${business.name} · ${business.branch}`
        : business.name,
      owner: business.ownerName ?? "Not recorded",
      email: business.email ?? "Not recorded",
      plan:
        business.subscription?.planType ??
        business.latestLicense?.licenseType ??
        "unassigned",
      userCount: business._count.users,
      deviceCount: business._count.devices,
      status: status.includes("trial")
        ? "trial"
        : status.includes("active")
          ? "active"
          : status.includes("suspend") || status.includes("inactive")
            ? "suspended"
            : "unknown",
      mpesaIntegrations: business.mpesaIntegrations,
    }
  })
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)),
  )
  const statusCount = (status: string) =>
    Object.entries(data?.statusCounts ?? {}).reduce(
      (count, [key, value]) =>
        count + (key.toLowerCase() === status ? value : 0),
      0,
    )
  const pageNumbers = Array.from(
    new Set(
      [1, page - 1, page, page + 1, totalPages].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  )

  return (
    <div className="admin-page-stack">
      <div className="admin-telemetry-strip">
        {[
          ["Registered businesses", (data?.total ?? 0).toLocaleString()],
          ["Active businesses", statusCount("active").toLocaleString()],
          [
            "Trial subscriptions",
            (data?.subscriptionStatusCounts.TRIAL ?? 0).toLocaleString(),
          ],
          ["Legacy licenses", (data?.legacyLicenseCount ?? 0).toLocaleString()],
          [
            "Visible users",
            tenants
              .reduce((total, tenant) => total + tenant.userCount, 0)
              .toLocaleString(),
          ],
          [
            "Registered devices",
            tenants
              .reduce((total, tenant) => total + tenant.deviceCount, 0)
              .toLocaleString(),
          ],
        ].map((item) => (
          <div key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
          </div>
        ))}
      </div>
      <div className="admin-toolbar">
        <div className="admin-search-field">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search store, owner, or tenant ID…"
          />
        </div>
        <select
          value={plan}
          onChange={(event) => {
            setPlan(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">All license tiers</option>
          <option value="enterprise">Enterprise</option>
          <option value="growth">Growth</option>
          <option value="basic">Basic</option>
        </select>
        <button
          className="admin-primary-button"
          onClick={() =>
            setToast("Tenant provisioning is not available in the admin API.")
          }
        >
          <Icon name="plus" /> Provision tenant
        </button>
      </div>
      <section className="admin-table-panel">
        <div className="admin-table-summary">
          <div>
            <strong>{data?.total ?? 0}</strong>
            <span>visible storefront tenants</span>
          </div>
          <div className="admin-summary-chips">
            <span>
              <i className="active" />
              {statusCount("active").toLocaleString()} active
            </span>
            <span>
              <i className="trial" />
              {(data?.subscriptionStatusCounts.TRIAL ?? 0).toLocaleString()}{" "}
              trial
            </span>
            <span>
              <i className="suspended" />
              {statusCount("suspended").toLocaleString()} suspended
            </span>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Store / Tenant</th>
                <th>Active owner</th>
                <th>License tier</th>
                <th>Registered users</th>
                <th>Registered devices</th>
                <th>Status</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => {
                    setSelected(tenant)
                  }}
                >
                  <td>
                    <div className="admin-business-cell">
                      <div className="admin-store-avatar">
                        {tenant.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </div>
                      <div>
                        <strong>{tenant.name}</strong>
                        <span>{tenant.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{tenant.owner}</strong>
                    <span className="admin-cell-sub">{tenant.email}</span>
                  </td>
                  <td>
                    <span className={`admin-plan-badge ${tenant.plan}`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td>
                    <span className="admin-mono">{tenant.userCount}</span>
                  </td>
                  <td>
                    <span className="admin-mono">{tenant.deviceCount}</span>
                  </td>
                  <td>
                    <span className={`admin-status-badge ${tenant.status}`}>
                      <i />
                      {tenant.status}
                    </span>
                  </td>
                  <td>
                    <button className="admin-row-button">
                      <Icon name="chevron" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7}>Loading businesses…</td>
                </tr>
              )}
              {!loading && !error && tenants.length === 0 && (
                <tr>
                  <td colSpan={7}>No businesses match this search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer">
          <span>
            {error || (loading && !data)
              ? error || "Loading businesses…"
              : `Showing ${tenants.length} of ${data?.total ?? 0} businesses`}
          </span>
          <div>
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            {pageNumbers.map((value) => (
              <button
                key={value}
                className={page === value ? "active" : ""}
                onClick={() => setPage(value)}
              >
                {value}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
            <button onClick={refresh}>Refresh</button>
          </div>
        </div>
      </section>
      {selected && (
        <div
          className="admin-drawer-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <aside className="admin-drawer">
            <div className="admin-drawer-head">
              <div className="admin-store-avatar large">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span>SECURE GATEWAY INSPECTOR</span>
                <h2>{selected.name}</h2>
                <p>
                  {selected.id} · {selected.plan.toUpperCase()}
                </p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-drawer-body">
              {(() => {
                const integration = selected.mpesaIntegrations[0]
                return (
                  <>
                    <div className="admin-drawer-section-title">
                      <Icon name="lock" />
                      <div>
                        <strong>Financial connection layer</strong>
                        <span>Read-only integration metadata</span>
                      </div>
                      <span className="admin-encrypted-badge">MASKED</span>
                    </div>
                    <div className="admin-form-grid two">
                      <label>
                        <span>Gateway environment</span>
                        <select value={integration?.environment ?? ""} disabled>
                          {!integration && (
                            <option value="">Not configured</option>
                          )}
                          <option>production</option>
                          <option>sandbox</option>
                        </select>
                      </label>
                      <label>
                        <span>Integration type</span>
                        <select value={integration?.accountType ?? ""} disabled>
                          {!integration && (
                            <option value="">Not configured</option>
                          )}
                          <option value="buygoods">Buy Goods Till</option>
                          <option>Paybill</option>
                        </select>
                      </label>
                    </div>
                    <label className="admin-field">
                      <span>M-PESA shortcode</span>
                      <input
                        value={integration?.shortcode ?? "Not configured"}
                        readOnly
                      />
                    </label>
                    {["Consumer Key", "Consumer Secret", "Daraja Passkey"].map(
                      (label) => (
                        <label className="admin-field" key={label}>
                          <span>{label}</span>
                          <div className="admin-secret-input">
                            <input
                              type="password"
                              value=""
                              placeholder={
                                integration
                                  ? "Encrypted credential is not exposed"
                                  : "No integration configured"
                              }
                              readOnly
                            />
                            <span>HIDDEN</span>
                          </div>
                        </label>
                      ),
                    )}
                    <div className="admin-audit-result">
                      <div>
                        <Icon name="webhook" />
                        <div>
                          <strong>Webhook diagnostics unavailable</strong>
                          <span>
                            No admin callback-audit endpoint is configured.
                          </span>
                        </div>
                      </div>
                      <button disabled>Audit unavailable</button>
                    </div>
                    <div className="admin-detail-list">
                      {[
                        [
                          "Configured integrations",
                          String(selected.mpesaIntegrations.length),
                        ],
                        [
                          "Account type",
                          integration?.accountType ?? "Not configured",
                        ],
                        [
                          "Shortcode",
                          integration?.shortcode ?? "Not configured",
                        ],
                        ["Party B", integration?.partyB ?? "Not recorded"],
                      ].map((item) => (
                        <div key={item[0]}>
                          <span>{item[0]}</span>
                          <strong className="admin-mono">{item[1]}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="admin-drawer-footer">
              <button
                className="admin-secondary-button"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              <button
                className="admin-emerald-button"
                disabled
                title="This admin API exposes configuration metadata as read-only."
              >
                Configuration is read-only
              </button>
            </div>
          </aside>
        </div>
      )}
      {toast && <Toast message={toast} close={() => setToast("")} />}
    </div>
  )
}

type AdminUser = {
  id: string
  display: string
  legal: string
  email: string
  role: string
  sessions: number
  last: string
  state: string
  phone: string | null
  businessName: string
  createdAt: string
}

export function AdminIdentity() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [role, setRole] = useState("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [toast, setToast] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const params = new URLSearchParams({
    q: debouncedQuery,
    role,
    page: String(page),
  })
  const { data, loading, error, refresh } = useAdminApi<AdminIdentityData>(
    `/api/admin/identity?${params}`,
  )
  const users: AdminUser[] = (data?.users ?? []).map((user) => ({
    id: user.id,
    display: user.fullName,
    legal: user.fullName,
    email: user.email ?? "Not recorded",
    role: user.role,
    sessions: user.deviceCount,
    last: user.lastSeen
      ? new Date(user.lastSeen).toLocaleString()
      : "No recorded access",
    state: user.status.toLowerCase(),
    phone: user.phone,
    businessName: user.business.branch
      ? `${user.business.name} · ${user.business.branch}`
      : user.business.name,
    createdAt: user.createdAt,
  }))
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)),
  )
  const pageNumbers = Array.from(
    new Set(
      [1, page - 1, page, page + 1, totalPages].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  )
  const roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: "Platform-wide administration",
    STORE_OWNER: "Business owner access",
    OWNER: "Business owner access",
    ACCOUNTANT: "Financial operations",
    CASHIER: "Point-of-sale access",
  }
  const roleStats = (data?.roleCounts ?? []).map((item) => [
    item.role,
    item.count.toLocaleString(),
    roleDescriptions[item.role] ?? "Role assigned to registered users",
  ])

  return (
    <div className="admin-page-stack">
      <section className="admin-role-grid">
        {roleStats.map((role) => (
          <button
            className="admin-role-card"
            key={role[0]}
            onClick={() => {
              setRole(role[0])
              setPage(1)
            }}
          >
            <div className="admin-role-card-top">
              <span className={`admin-role-badge ${role[0].toLowerCase()}`}>
                {role[0]}
              </span>
              <strong>{role[1]}</strong>
            </div>
            <p>{role[2]}</p>
            <div>
              <span>View clearance policy</span>
              <Icon name="chevron" size={11} />
            </div>
          </button>
        ))}
      </section>
      <div className="admin-toolbar">
        <div className="admin-search-field">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search identity, legal name, or system ID…"
          />
        </div>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">All clearance levels</option>
          {roleStats.map((item) => (
            <option key={item[0]} value={item[0]}>
              {item[0]}
            </option>
          ))}
        </select>
        <button
          className="admin-primary-button"
          onClick={() =>
            setToast("Identity invitations are not available in the admin API.")
          }
        >
          <Icon name="plus" /> Invite identity
        </button>
      </div>
      <section className="admin-table-panel">
        <div className="admin-table-title-row">
          <div>
            <span>HIERARCHICAL USER DIRECTORY</span>
            <h2>Platform identities & cross-device sessions</h2>
          </div>
          <div>
            <span className="admin-status-badge active">
              <i />
              {(data?.total ?? 0).toLocaleString()} user records
            </span>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User identity</th>
                <th>Legal name</th>
                <th>System ID</th>
                <th>Clearance level</th>
                <th>Registered devices</th>
                <th>Last access</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} onClick={() => setSelected(user)}>
                  <td>
                    <div className="admin-business-cell">
                      <div className="admin-user-avatar">
                        {user.display
                          .split(" ")
                          .map((value) => value[0])
                          .join("")}
                      </div>
                      <div>
                        <strong>{user.display}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-verified-name">
                      <strong>{user.legal}</strong>
                    </span>
                  </td>
                  <td>
                    <span className="admin-mono">{user.id}</span>
                    <span
                      className={`admin-cell-sub ${
                        user.state.toLowerCase() === "active" ? "" : "locked"
                      }`}
                    >
                      {user.state.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <select
                      className={`admin-role-select ${user.role.toLowerCase()}`}
                      value={user.role}
                      onClick={(event) => event.stopPropagation()}
                      disabled
                    >
                      <option>{user.role}</option>
                    </select>
                  </td>
                  <td>
                    <div className="admin-session-count">
                      <span>{user.sessions}</span>
                      <small>devices</small>
                    </div>
                  </td>
                  <td>
                    <span>{user.last}</span>
                  </td>
                  <td>
                    <button className="admin-row-button">
                      <Icon name="chevron" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7}>Loading user records…</td>
                </tr>
              )}
              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={7}>No users match this search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer">
          <span>
            {error || (loading && !data)
              ? error || "Loading user records…"
              : `Showing ${users.length} of ${data?.total ?? 0} users`}
          </span>
          <div>
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            {pageNumbers.map((value) => (
              <button
                key={value}
                className={page === value ? "active" : ""}
                onClick={() => setPage(value)}
              >
                {value}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
            <button onClick={refresh}>Refresh</button>
          </div>
        </div>
      </section>
      {selected && (
        <div
          className="admin-drawer-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <aside className="admin-drawer">
            <div className="admin-drawer-head">
              <div className="admin-user-avatar">
                {selected.display
                  .split(" ")
                  .map((value) => value[0])
                  .join("")}
              </div>
              <div>
                <span>IDENTITY INSPECTOR</span>
                <h2>{selected.legal}</h2>
                <p>
                  {selected.id} · {selected.role}
                </p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-drawer-section-title">
                <Icon name="shield" />
                <div>
                  <strong>User record</strong>
                  <span>Database-backed identity and access metadata</span>
                </div>
                <span className="admin-encrypted-badge">
                  {selected.state.toUpperCase()}
                </span>
              </div>
              <div className="admin-detail-list">
                {[
                  ["Display identity", selected.display],
                  ["Legal name", "Not stored separately"],
                  ["Primary email", selected.email],
                  ["Phone", selected.phone ?? "Not recorded"],
                  ["System ID", selected.id],
                  ["Role", selected.role],
                  ["Business", selected.businessName],
                  ["Registered devices", String(selected.sessions)],
                  ["Last access", selected.last],
                  [
                    "Account created",
                    new Date(selected.createdAt).toLocaleString(),
                  ],
                ].map((item) => (
                  <div key={item[0]}>
                    <span>{item[0]}</span>
                    <strong>{item[1]}</strong>
                  </div>
                ))}
              </div>
              <div className="admin-tenant-360-grid">
                <div>
                  <span>DEVICE DETAILS</span>
                  <strong>{selected.sessions} registered device records</strong>
                  <small>
                    Per-device session details are not exposed by this API.
                  </small>
                </div>
              </div>
            </div>
            <div className="admin-drawer-footer">
              <button
                className="admin-danger-button"
                disabled
                title="Session revocation is not available in the admin API."
              >
                Session revocation unavailable
              </button>
              <span />
              <button
                className="admin-secondary-button"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )}
      {toast && <Toast message={toast} close={() => setToast("")} />}
    </div>
  )
}

type License = {
  id: string
  businessId: string
  tenant: string
  tier: string
  expires: number | null
  expiresAt: string | null
  renewal: boolean
  status: string
  kind: "subscription" | "legacy"
}

export function AdminLicenses() {
  const [confirm, setConfirm] = useState<License | null>(null)
  const [toast, setToast] = useState("")
  const [actionId, setActionId] = useState("")
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionBusinesses, setProvisionBusinesses] =
    useState<AdminBusiness[]>([])
  const [provisionBusinessId, setProvisionBusinessId] = useState("")
  const [provisionPlan, setProvisionPlan] = useState("Basic")
  const [provisionDurationDays, setProvisionDurationDays] = useState(14)
  const [provisionLoading, setProvisionLoading] = useState(false)
  const [provisionError, setProvisionError] = useState("")
  const { data, loading, error, refresh } = useAdminApi<AdminLicenseData>(
    "/api/admin/licenses",
  )
  const licenses: License[] = [
    ...(data?.subscriptions ?? []).map((subscription): License => {
      const expiresAt =
        subscription.status === "TRIAL"
          ? subscription.trialEndsAt
          : (subscription.currentPeriodEndsAt ?? subscription.graceEndsAt)
      return {
        id: subscription.id,
        businessId: subscription.businessId,
        tenant: subscription.business.name,
        tier: subscription.planType.toLowerCase(),
        expires: expiresAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
              ),
            )
          : null,
        expiresAt,
        renewal: subscription.autoRenewActive,
        status: subscription.status.toLowerCase(),
        kind: "subscription",
      }
    }),
    ...(data?.legacyLicenses ?? []).map(
      (license): License => ({
        id: license.id,
        businessId: license.businessId,
        tenant: license.business.name,
        tier: license.licenseType.toLowerCase(),
        expires: Math.max(
          0,
          Math.ceil(
            (new Date(license.expiryDate).getTime() - Date.now()) / 86_400_000,
          ),
        ),
        expiresAt: license.expiryDate,
        renewal: false,
        status: license.status.toLowerCase(),
        kind: "legacy",
      }),
    ),
  ]
  const activeSubscriptions = (data?.subscriptions ?? []).filter(
    (subscription) => subscription.status === "ACTIVE",
  )
  const monthlyRevenue = activeSubscriptions.reduce(
    (total, subscription) => total + subscription.licenseCost,
    0,
  )
  const renewalWindow = licenses.filter(
    (license) =>
      license.status === "active" &&
      license.expires !== null &&
      license.expires <= 30,
  )
  const renewalRevenue = activeSubscriptions
    .filter(
      (subscription) =>
        subscription.currentPeriodEndsAt !== null &&
        new Date(subscription.currentPeriodEndsAt).getTime() - Date.now() <=
          30 * 86_400_000,
    )
    .reduce((total, subscription) => total + subscription.licenseCost, 0)
  const attentionCount = licenses.filter((license) =>
    ["grace", "expired", "revoked", "suspended"].includes(license.status),
  ).length
  const plans = planCatalog.map((plan) => ({
    key: plan.name.toLowerCase(),
    name: plan.subtitle,
    price: `KSh ${plan.monthlyPriceKsh.toLocaleString()}${plan.priceSuffix ?? ""}`,
    tone: plan.color,
    stores: plan.audience,
    features: plan.adminFeatures,
    upgradeRulesEnabled: plan.upgradeRulesEnabled,
  }))

  const openProvisionFlow = async () => {
    setProvisionLoading(true)
    setProvisionError("")
    try {
      const tenants = await adminApi<AdminTenantsData>(
        "/api/admin/tenants?subscription=unclaimed&page=1",
      )
      setProvisionBusinesses(tenants.businesses)
      setProvisionBusinessId(tenants.businesses[0]?.id ?? "")
      if (tenants.businesses.length === 0) {
        setProvisionError("No businesses without a subscription were found.")
      }
      setProvisionOpen(true)
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "Unable to load businesses for trial provisioning.",
      )
    } finally {
      setProvisionLoading(false)
    }
  }

  const provisionTrial = async () => {
    setProvisionLoading(true)
    setProvisionError("")
    try {
      await adminApi("/api/admin/licenses", {
        method: "POST",
        body: JSON.stringify({
          action: "PROVISION_TRIAL",
          businessId: provisionBusinessId,
          planType: provisionPlan,
          durationDays: provisionDurationDays,
        }),
      })
      const tenant =
        provisionBusinesses.find(
          (business) => business.id === provisionBusinessId,
        )?.name ?? "Business"
      setProvisionOpen(false)
      setToast(
        `${provisionDurationDays}-day ${provisionPlan} trial provisioned for ${tenant}`,
      )
      refresh()
    } catch (reason) {
      setProvisionError(
        reason instanceof Error
          ? reason.message
          : "Unable to provision the trial subscription.",
      )
    } finally {
      setProvisionLoading(false)
    }
  }

  const updateSubscription = async (
    license: License,
    action: "AUTO_RENEW" | "REVOKE",
    autoRenewActive?: boolean,
  ) => {
    setActionId(license.id)
    try {
      await adminApi("/api/admin/licenses", {
        method: "PATCH",
        body: JSON.stringify({
          action,
          subscriptionId: license.id,
          ...(typeof autoRenewActive === "boolean" ? { autoRenewActive } : {}),
        }),
      })
      setConfirm(null)
      setToast(
        action === "REVOKE"
          ? `Subscription revoked for ${license.tenant}`
          : `Automatic renewal ${
              autoRenewActive ? "enabled" : "disabled"
            } for ${license.tenant}`,
      )
      refresh()
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "Subscription update failed.",
      )
    } finally {
      setActionId("")
    }
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-license-metrics">
        {[
          [
            "Monthly recurring revenue",
            `KSh ${monthlyRevenue.toLocaleString()}`,
            "Active subscription license cost",
          ],
          [
            "Active contracts",
            activeSubscriptions.length.toLocaleString(),
            `${(data?.subscriptions.length ?? 0).toLocaleString()} platform subscriptions`,
          ],
          [
            "Renewal pipeline",
            `KSh ${renewalRevenue.toLocaleString()}`,
            `${renewalWindow.length.toLocaleString()} contracts due within 30 days`,
          ],
          [
            "Enforcement queue",
            attentionCount.toLocaleString(),
            "Grace, expired, revoked, or suspended records",
          ],
        ].map((item) => (
          <div key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
            <small>{item[2]}</small>
          </div>
        ))}
      </section>
      <section className="admin-plan-grid">
        {plans.map((plan) => (
          <article className={`admin-plan-card ${plan.tone}`} key={plan.key}>
            <div className="admin-plan-head">
              <div>
                <span>{plan.stores}</span>
                <h2>{plan.name}</h2>
              </div>
              <span
                className={`admin-plan-badge ${
                  plan.key === "enterprise"
                    ? "enterprise"
                    : plan.key === "growth"
                      ? "growth"
                      : "basic"
                }`}
              >
                LIVE
              </span>
            </div>
            <div className="admin-plan-price">
              <strong>{plan.price}</strong>
              <span>/ month</span>
            </div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Icon name="check" size={12} />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="admin-plan-rule">
              <div>
                <strong>Deploy Live Upgrade Rules</strong>
                <span>
                  {plan.upgradeRulesEnabled
                    ? "Enabled in plan configuration"
                    : "Disabled in plan configuration"}
                </span>
              </div>
              <button
                className={`admin-toggle ${
                  plan.upgradeRulesEnabled ? "on" : ""
                }`}
                disabled
                title="Upgrade rules are managed in platform configuration."
              >
                <span />
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="admin-table-panel">
        <div className="admin-table-title-row">
          <div>
            <span>PLATFORM SUBSCRIPTIONS & LEGACY LICENSES</span>
            <h2>Contract timelines</h2>
          </div>
          <div>
            <button className="admin-secondary-button" onClick={refresh}>
              Refresh contract data
            </button>
            <button
              className="admin-primary-button"
              onClick={openProvisionFlow}
              disabled={provisionLoading}
            >
              <Icon name="plus" /> Provision trial
            </button>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tenant identifier</th>
                <th>License contract</th>
                <th>Tier</th>
                <th>Expiration counter</th>
                <th>Automatic renewal</th>
                <th>Status</th>
                <th>Administrative action</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td>
                    <div className="admin-business-cell">
                      <div className="admin-store-avatar">
                        {license.tenant.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{license.tenant}</strong>
                        <span>
                          {license.kind === "subscription"
                            ? "Platform subscription"
                            : "Legacy device license"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-mono">{license.id}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-plan-badge ${
                        ["enterprise", "growth", "basic"].includes(license.tier)
                          ? license.tier
                          : "basic"
                      }`}
                    >
                      {license.tier}
                    </span>
                  </td>
                  <td>
                    <span className="admin-mono">
                      {license.expires === null
                        ? "No expiry date"
                        : license.expires > 0
                          ? `${license.expires} days`
                          : "Expired"}
                    </span>
                    <small
                      className={`admin-countdown ${
                        license.expires !== null && license.expires < 2
                          ? "urgent"
                          : license.expires !== null && license.expires < 8
                            ? "warning"
                            : ""
                      }`}
                    >
                      {license.expiresAt
                        ? `Expires ${new Date(license.expiresAt).toLocaleDateString()}`
                        : "No expiry recorded"}
                    </small>
                  </td>
                  <td>
                    <div className="admin-renewal-cell">
                      <button
                        className={`admin-toggle ${
                          license.renewal ? "on" : ""
                        }`}
                        disabled={
                          license.kind !== "subscription" ||
                          license.status !== "active" ||
                          actionId === license.id
                        }
                        onClick={() =>
                          updateSubscription(
                            license,
                            "AUTO_RENEW",
                            !license.renewal,
                          )
                        }
                      >
                        <span />
                      </button>
                      <small>
                        {license.kind === "subscription"
                          ? license.renewal
                            ? "Enabled"
                            : "Manual"
                          : "Legacy"}
                      </small>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status-badge ${license.status}`}>
                      <i />
                      {license.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="admin-danger-button"
                      disabled={
                        license.kind !== "subscription" ||
                        ["revoked", "suspended"].includes(license.status) ||
                        actionId === license.id
                      }
                      onClick={() => setConfirm(license)}
                    >
                      Revoke subscription
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="admin-table-summary">
              Loading subscription data…
            </div>
          )}
          {error && (
            <div className="admin-table-summary">
              <span>{error}</span>
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {!loading && !error && licenses.length === 0 && (
            <div className="admin-table-summary">
              No subscription or legacy license records found.
            </div>
          )}
        </div>
      </section>
      {confirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-head">
              <div>
                <span>DESTRUCTIVE ENFORCEMENT</span>
                <h2>Revoke platform subscription?</h2>
                <p>
                  {confirm.tenant} · {confirm.id}
                </p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setConfirm(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="ops-attention-strip">
                <div>
                  <span className="ops-status-dot critical" />
                  <div>
                    <strong>The platform subscription will be revoked</strong>
                    <span>
                      This changes the subscription record only. It does not
                      revoke user sessions or device registrations.
                    </span>
                  </div>
                </div>
              </div>
              <div className="admin-detail-list">
                {[
                  ["Tenant", confirm.tenant],
                  ["License", confirm.id],
                  ["Current tier", confirm.tier.toUpperCase()],
                  ["Renewal policy", confirm.renewal ? "Automatic" : "Manual"],
                  [
                    "Record type",
                    confirm.kind === "subscription"
                      ? "Platform subscription"
                      : "Legacy license",
                  ],
                ].map((item) => (
                  <div key={item[0]}>
                    <span>{item[0]}</span>
                    <strong>{item[1]}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-secondary-button"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="admin-danger-button"
                disabled={
                  confirm.kind !== "subscription" || actionId === confirm.id
                }
                onClick={() => updateSubscription(confirm, "REVOKE")}
              >
                Confirm subscription revocation
              </button>
            </div>
          </div>
        </div>
      )}
      {provisionOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-head">
              <div>
                <span>PLATFORM SUBSCRIPTION</span>
                <h2>Provision a trial subscription</h2>
                <p>
                  Only businesses without an existing platform subscription are
                  listed.
                </p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setProvisionOpen(false)}
                disabled={provisionLoading}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Business</span>
                  <select
                    value={provisionBusinessId}
                    onChange={(event) =>
                      setProvisionBusinessId(event.target.value)
                    }
                    disabled={
                      provisionBusinesses.length === 0 || provisionLoading
                    }
                  >
                    {provisionBusinesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                        {business.branch ? ` · ${business.branch}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Plan</span>
                  <select
                    value={provisionPlan}
                    onChange={(event) => setProvisionPlan(event.target.value)}
                    disabled={provisionLoading}
                  >
                    {planCatalog.map((plan) => (
                      <option key={plan.name} value={plan.name}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Trial duration</span>
                  <select
                    value={provisionDurationDays}
                    onChange={(event) =>
                      setProvisionDurationDays(Number(event.target.value))
                    }
                    disabled={provisionLoading}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                  </select>
                </label>
              </div>
              {provisionError && <p role="alert">{provisionError}</p>}
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-secondary-button"
                onClick={() => setProvisionOpen(false)}
                disabled={provisionLoading}
              >
                Cancel
              </button>
              <button
                className="admin-primary-button"
                onClick={provisionTrial}
                disabled={
                  provisionLoading ||
                  !provisionBusinessId ||
                  provisionBusinesses.length === 0
                }
              >
                {provisionLoading ? "Provisioning…" : "Provision trial"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} close={() => setToast("")} />}
    </div>
  )
}

export function AdminInfrastructure() {
  const services = [
    {
      name: "API Gateway",
      region: "KE-CENTRAL-01",
      load: 64,
      status: "HEALTHY",
    },
    {
      name: "Sync Worker Pool",
      region: "KE-WEST-02",
      load: 82,
      status: "ATTENTION",
    },
    {
      name: "Tenant PostgreSQL",
      region: "KE-CENTRAL-01",
      load: 58,
      status: "HEALTHY",
    },
    {
      name: "Redis Cache Mesh",
      region: "KE-CENTRAL-02",
      load: 41,
      status: "HEALTHY",
    },
  ]
  const chart = [
    { t: "06", v: 42 },
    { t: "09", v: 66 },
    { t: "12", v: 58 },
    { t: "15", v: 81 },
    { t: "18", v: 74 },
    { t: "21", v: 49 },
  ]
  return (
    <div className="admin-page-stack">
      <div className="admin-infra-health">
        {[
          ["API edge", "Operational", "P95 182ms"],
          ["Worker capacity", "74% utilized", "28 active workers"],
          ["Data plane", "Healthy", "12 tenant shards"],
        ].map((item, index) => (
          <div key={item[0]}>
            <i className={index === 1 ? "cyan" : "admin-live-dot"} />
            <div>
              <span>{item[0]}</span>
              <strong>{item[1]}</strong>
            </div>
            <code>{item[2]}</code>
          </div>
        ))}
      </div>
      <section className="admin-bento-grid">
        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>RUNTIME TELEMETRY</span>
              <h2>Global request processing load</h2>
            </div>
          </div>
          <div className="admin-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="infra" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4e7fe8" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#4e7fe8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  stroke="#53627e"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis stroke="#53627e" axisLine={false} tickLine={false} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#4e7fe8"
                  fill="url(#infra)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>SERVICE REGIONS</span>
              <h2>Runtime availability</h2>
            </div>
          </div>
          <div className="admin-stream-list">
            {services.map((service) => (
              <div className="admin-stream-row" key={service.name}>
                <i
                  className={`admin-stream-status ${
                    service.status === "HEALTHY" ? "complete" : "pending"
                  }`}
                />
                <div className="admin-stream-main">
                  <strong>{service.name}</strong>
                  <span>{service.region}</span>
                </div>
                <div className="admin-stream-meta">
                  <strong>{service.load}%</strong>
                  <span
                    className={
                      service.status === "HEALTHY" ? "complete" : "pending"
                    }
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

interface ToastProps {
  message: string
  close: () => void
}

function Toast({ message, close }: ToastProps) {
  return (
    <div className="ops-toast">
      <span>✓</span>
      <div>
        <strong>Operation completed</strong>
        <small>{message}</small>
      </div>
      <button onClick={close}>×</button>
    </div>
  )
}

export function AdminNotFound() {
  return (
    <div className="admin-empty-state">
      <Icon name="alert" size={42} />
      <h2>Control plane route not found</h2>
      <p>
        The requested administrative workspace is not registered in this
        environment.
      </p>
      <Link href="/admin2">Return to platform overview</Link>
    </div>
  )
}
