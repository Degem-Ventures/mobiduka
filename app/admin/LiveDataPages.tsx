"use client"

import { useEffect, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type AdminPageMetadata = {
  total: number
  page: number
  pageSize: number
}

type BusinessRecord = {
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
}

type TenantResponse = AdminPageMetadata & {
  businesses: BusinessRecord[]
  statusCounts: Record<string, number>
  legacyLicenseCount: number
}

type UserRecord = {
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

type IdentityResponse = AdminPageMetadata & {
  users: UserRecord[]
  roleCounts: Array<{
    role: string
    count: number
  }>
}

type OverviewResponse = {
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
  }>
  trend: Array<{
    day: string
    completedSales: number
    businessesCreated: number
  }>
  generatedAt: string
}

async function getAdminJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal })
  const result = (await response.json()) as { error?: string }
  if (!response.ok) {
    throw new Error(result.error ?? "Unable to load platform data.")
  }
  return result as T
}

function useAdminResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setData(null)
    void getAdminJson<T>(url, controller.signal)
      .then(setData)
      .catch((reason) => {
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

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debouncedValue
}

function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number>>,
) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const quote = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  const csv = [
    headers.map(quote).join(","),
    ...rows.map((row) =>
      headers.map((header) => quote(row[header] ?? "")).join(","),
    ),
  ].join("\n")
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <div className="admin-table-footer">
      <span>
        Showing {first}–{last} of {total}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <span>
          {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (["active", "trial", "success", "completed", "paid"].includes(normalized))
    return "active"
  if (["grace", "pending"].includes(normalized)) return "warning"
  if (
    ["expired", "revoked", "suspended", "inactive", "disabled"].includes(
      normalized,
    )
  )
    return "suspended"
  return "info"
}

export function AdminOverview() {
  const { data, loading, error, refresh } = useAdminResource<OverviewResponse>(
    "/api/admin/overview",
  )
  const metrics = data?.metrics
  const cards = [
    ["Businesses", metrics?.businesses.toLocaleString() ?? "—"],
    ["Users", metrics?.users.toLocaleString() ?? "—"],
    ["Active devices", metrics?.activeDevices.toLocaleString() ?? "—"],
    [
      "Completed sales · 30 days",
      metrics?.completedSales30d.toLocaleString() ?? "—",
    ],
    [
      "Sales value · 30 days (unconverted)",
      metrics ? metrics.salesVolume30d.toLocaleString("en-KE") : "—",
    ],
    [
      "Active subscriptions",
      metrics?.activeSubscriptions.toLocaleString() ?? "—",
    ],
    [
      "Trial subscriptions",
      metrics?.trialSubscriptions.toLocaleString() ?? "—",
    ],
    [
      "Subscriptions needing attention",
      metrics?.attentionSubscriptions.toLocaleString() ?? "—",
    ],
  ]

  return (
    <div className="admin-page-stack">
      <div className="admin-section-head">
        <div className="admin-date-filter">
          <span className="admin-live-dot" />
          {data
            ? `Database data · refreshed ${new Date(data.generatedAt).toLocaleTimeString()}`
            : "Live database data"}
        </div>
        <button
          className="admin-secondary-button"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      {error && (
        <div className="admin-empty-state" role="alert">
          {error}
        </div>
      )}
      <section className="admin-metric-grid">
        {cards.map(([label, value]) => (
          <article className="admin-metric-card" key={label}>
            <div className="admin-metric-label">{label}</div>
            <div className="admin-metric-value">
              {loading && !data ? "…" : value}
            </div>
            <div className="admin-metric-foot">
              <span>
                {label.startsWith("Sales value")
                  ? "Sum of stored amounts; currencies are not converted."
                  : "Source: current database records"}
              </span>
            </div>
          </article>
        ))}
      </section>
      <article className="admin-panel admin-chart-panel">
        <div className="admin-panel-heading">
          <div>
            <span>Last 30 days · Database aggregates</span>
            <h2>Completed sales &amp; business registrations</h2>
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
          {loading && !data ? (
            <div className="admin-empty-state">Loading chart data…</div>
          ) : !data?.trend.length ? (
            <div className="admin-empty-state">No trend data is available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.trend}
                margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#60708E"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                />
                <YAxis
                  yAxisId="sales"
                  stroke="#48A95A"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="businesses"
                  orientation="right"
                  stroke="#4E7FE8"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1930",
                    border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 9,
                    color: "#E8EEFC",
                  }}
                  formatter={(value, name) => [
                    value,
                    name === "completedSales"
                      ? "Completed sales"
                      : "Businesses created",
                  ]}
                />
                <Line
                  yAxisId="sales"
                  type="monotone"
                  dataKey="completedSales"
                  name="Completed sales"
                  stroke="#48A95A"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="businesses"
                  type="monotone"
                  dataKey="businessesCreated"
                  name="Businesses created"
                  stroke="#4E7FE8"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
      <div className="admin-table-panel">
        <div className="admin-table-title-row">
          <div>
            <span>M-PESA transactions</span>
            <h2>Latest recorded payment requests</h2>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Business</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentMpesaTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="admin-mono">
                    {transaction.checkoutRequestId}
                  </td>
                  <td>{transaction.businessName}</td>
                  <td>KSh {transaction.amount.toLocaleString("en-KE")}</td>
                  <td>
                    <span
                      className={`admin-status-badge ${statusClass(transaction.status)}`}
                    >
                      <i />
                      {transaction.status}
                    </span>
                  </td>
                  <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && data?.recentMpesaTransactions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    No M-PESA transactions have been recorded.
                  </td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td colSpan={5}>Loading database records…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminTenants() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 250)
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BusinessRecord | null>(null)
  const params = new URLSearchParams({
    q: debouncedQuery,
    status,
    page: String(page),
  })
  const { data, loading, error, refresh } = useAdminResource<TenantResponse>(
    `/api/admin/tenants?${params.toString()}`,
  )
  const businesses = data?.businesses ?? []

  return (
    <div className="admin-page-stack">
      <div className="admin-toolbar">
        <div className="admin-search-field">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search businesses, owners, email or ID…"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">All business statuses</option>
          {Object.keys(data?.statusCounts ?? {}).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          className="admin-secondary-button"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
        <button
          className="admin-secondary-button"
          disabled={!businesses.length}
          onClick={() =>
            downloadCsv(
              "mobiduka-business-registry.csv",
              businesses.map((business) => ({
                BusinessID: business.id,
                Business: business.name,
                Branch: business.branch ?? "",
                Owner: business.ownerName ?? "",
                Email: business.email ?? "",
                Status: business.status,
                Plan: business.subscription?.planType ?? "",
                SubscriptionStatus: business.subscription?.status ?? "",
                Users: business._count.users,
                Devices: business._count.devices,
              })),
            )
          }
        >
          Export current page
        </button>
      </div>
      {error && (
        <div className="admin-empty-state" role="alert">
          {error}
        </div>
      )}
      <div className="admin-table-panel">
        <div className="admin-table-summary">
          <div>
            <strong>{data?.total.toLocaleString() ?? "—"}</strong>
            <span>businesses</span>
          </div>
          <div className="admin-summary-chips">
            {Object.entries(data?.statusCounts ?? {}).map(([key, count]) => (
              <span key={key}>
                <i className={statusClass(key)} />
                {key}: {count.toLocaleString()}
              </span>
            ))}
            <span>
              Legacy device-license rows:{" "}
              {data?.legacyLicenseCount.toLocaleString() ?? "—"}
            </span>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Subscription</th>
                <th>Users / devices</th>
                <th>Business status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business.id} onClick={() => setSelected(business)}>
                  <td>
                    <div className="admin-business-cell">
                      <div className="admin-store-avatar">
                        {business.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{business.name}</strong>
                        <span>
                          {business.id}
                          {business.branch ? ` · ${business.branch}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-person-cell">
                      <strong>{business.ownerName ?? "—"}</strong>
                      <span>
                        {business.email ??
                          business.phone ??
                          "No contact details"}
                      </span>
                    </div>
                  </td>
                  <td>
                    {business.subscription ? (
                      <>
                        <strong>{business.subscription.planType}</strong>
                        <span className="admin-cell-sub">
                          {business.subscription.status}
                        </span>
                      </>
                    ) : (
                      "No subscription"
                    )}
                  </td>
                  <td>
                    <strong>{business._count.users} users</strong>
                    <span className="admin-cell-sub">
                      {business._count.devices} registered devices
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-status-badge ${statusClass(business.status)}`}
                    >
                      <i />
                      {business.status}
                    </span>
                  </td>
                  <td>{new Date(business.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!loading && businesses.length === 0 && (
                <tr>
                  <td colSpan={6}>No businesses match this search.</td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td colSpan={6}>Loading businesses…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={setPage}
          />
        )}
      </div>
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
                <span>{selected.id}</span>
                <h2>{selected.name}</h2>
                <p>{selected.branch ?? "No branch recorded"}</p>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setSelected(null)}
                aria-label="Close business details"
              >
                ×
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-detail-list">
                <div>
                  <span>Business status</span>
                  <strong>{selected.status}</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{selected.ownerName ?? "Not recorded"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selected.email ?? "Not recorded"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{selected.phone ?? "Not recorded"}</strong>
                </div>
                <div>
                  <span>Users</span>
                  <strong>{selected._count.users}</strong>
                </div>
                <div>
                  <span>Registered devices</span>
                  <strong>{selected._count.devices}</strong>
                </div>
                <div>
                  <span>Platform subscription</span>
                  <strong>
                    {selected.subscription
                      ? `${selected.subscription.planType} · ${selected.subscription.status}`
                      : "None"}
                  </strong>
                </div>
                <div>
                  <span>Legacy license</span>
                  <strong>
                    {selected.latestLicense
                      ? `${selected.latestLicense.licenseType} · ${selected.latestLicense.status} · ${new Date(selected.latestLicense.expiryDate).toLocaleDateString()}`
                      : "None"}
                  </strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export function AdminIdentity() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 250)
  const [role, setRole] = useState("all")
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({
    q: debouncedQuery,
    role,
    page: String(page),
  })
  const { data, loading, error, refresh } = useAdminResource<IdentityResponse>(
    `/api/admin/identity?${params.toString()}`,
  )
  const users = data?.users ?? []

  return (
    <div className="admin-page-stack">
      <section className="admin-role-grid">
        {(data?.roleCounts ?? []).map((item) => (
          <button
            className="admin-role-card blue"
            key={item.role}
            onClick={() => {
              setRole(role === item.role ? "all" : item.role)
              setPage(1)
            }}
          >
            <div className="admin-role-card-top">
              <span className="admin-role-badge">{item.role}</span>
              <strong>{item.count.toLocaleString()}</strong>
            </div>
            <p>Database users assigned to this role across businesses.</p>
            <div>
              <span>Filter users by role</span>
            </div>
          </button>
        ))}
      </section>
      <div className="admin-toolbar">
        <div className="admin-search-field">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search user, email, business or ID…"
          />
        </div>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">All roles</option>
          {(data?.roleCounts ?? []).map((item) => (
            <option key={item.role} value={item.role}>
              {item.role}
            </option>
          ))}
        </select>
        <button
          className="admin-secondary-button"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
        <button
          className="admin-secondary-button"
          disabled={!users.length}
          onClick={() =>
            downloadCsv(
              "mobiduka-identity-ledger.csv",
              users.map((user) => ({
                UserID: user.id,
                Name: user.fullName,
                Email: user.email ?? "",
                Role: user.role,
                Business: user.business.name,
                BusinessID: user.business.id,
                Status: user.status,
                RegisteredDevices: user.deviceCount,
                LastSeen: user.lastSeen ?? "",
              })),
            )
          }
        >
          Export current page
        </button>
        <button
          className="admin-primary-button"
          disabled
          title="User invitation workflow is not implemented in the backend."
        >
          Invite user unavailable
        </button>
      </div>
      {error && (
        <div className="admin-empty-state" role="alert">
          {error}
        </div>
      )}
      <div className="admin-table-panel">
        <div className="admin-table-summary">
          <div>
            <strong>{data?.total.toLocaleString() ?? "—"}</strong>
            <span>user records</span>
          </div>
          <div className="admin-summary-chips">
            <span>
              Registered devices are shown; the app has no session registry.
            </span>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Business</th>
                <th>Role</th>
                <th>Registered devices</th>
                <th>Last seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-business-cell">
                      <div className="admin-user-avatar">
                        {user.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{user.fullName}</strong>
                        <span>
                          {user.id} · {user.email ?? "No email recorded"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{user.business.name}</strong>
                    <span className="admin-cell-sub">
                      {user.business.id}
                      {user.business.branch ? ` · ${user.business.branch}` : ""}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-role-badge ${user.role.toLowerCase()}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>{user.deviceCount}</td>
                  <td>
                    {user.lastSeen
                      ? new Date(user.lastSeen).toLocaleString()
                      : "Never recorded"}
                  </td>
                  <td>
                    <span
                      className={`admin-status-badge ${statusClass(user.status)}`}
                    >
                      <i />
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6}>No users match this search.</td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td colSpan={6}>Loading users…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
