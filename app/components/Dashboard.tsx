import { useState, useRef, useEffect } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

interface Props {
  onNavigate: (screen: string) => void
}

type DashboardData = {
  metadata: { name: string; branch: string | null; country: string; currency: string; timezone: string; date: string }
  summary: Record<string, number>
  paymentBreakdown: Record<string, { amount: number; transactions: number }>
  topProducts: Array<{ name: string; units: number; revenue: number }>
  recentTransactions: Array<{ id: string; time: string; customer: string; amount: number; items: number; method: string }>
  lowStockItems: Array<{ id: string; name: string; quantity: number; minimumStock: number | null }>
  scanActivity: { counts: Record<string, number>; recent: Array<{ id: string; barcode: string; name: string; status: string; emoji: string | null; createdAt: string }> }
}

const money = (value: number) => `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const calendarDate = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

const dayDifference = (timestamp: string, timeZone: string) => {
  const target = calendarDate(new Date(timestamp), timeZone).split('-').map(Number)
  const today = calendarDate(new Date(), timeZone).split('-').map(Number)
  const targetUtc = Date.UTC(target[0], target[1] - 1, target[2])
  const todayUtc = Date.UTC(today[0], today[1] - 1, today[2])
  return Math.max(0, Math.floor((todayUtc - targetUtc) / 86400000))
}

const relativeTimeLabel = (timestamp: string, timeZone: string) => {
  const time = new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
  const days = dayDifference(timestamp, timeZone)
  if (days === 0) return time
  if (days === 1) return `Yesterday · ${time}`
  if (days < 7) return `${days} days ago · ${time}`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks === 1 ? 'a' : weeks} week${weeks === 1 ? '' : 's'} ago · ${time}`
  const months = Math.floor(days / 30)
  if (days < 365) return `${months === 1 ? 'a' : months} month${months === 1 ? '' : 's'} ago · ${time}`
  const years = Math.floor(days / 365)
  return `${years === 1 ? 'a' : years} year${years === 1 ? '' : 's'} ago · ${time}`
}

export default function Dashboard({ onNavigate }: Props) {
  const c = useColors()
  const [scanPulse, setScanPulse] = useState(false)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const session = getClientSession()
    if (!session) {
      setError('Please sign in to load your dashboard.')
      return
    }
    apiFetch<DashboardData>(`/api/dashboard/summary?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard data.'))
  }, [])

  useEffect(() => {
    const session = getClientSession()
    if (!session) return
    apiFetch<{ unreadCount: number }>(`/api/notifications?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(response => setUnreadNotifications(response.unreadCount))
      .catch(() => setUnreadNotifications(0))
  }, [])

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    let raf: number
    const step = () => {
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        el.scrollLeft = 0
      } else {
        el.scrollLeft += 0.4
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const pause = () => cancelAnimationFrame(raf)
    const resume = () => { raf = requestAnimationFrame(step) }
    el.addEventListener('mouseenter', pause)
    el.addEventListener('touchstart', pause)
    el.addEventListener('mouseleave', resume)
    el.addEventListener('touchend', resume)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('mouseleave', resume)
      el.removeEventListener('touchend', resume)
    }
  }, [])

  const handleScanTap = () => {
    setScanPulse(true)
    setTimeout(() => { setScanPulse(false); onNavigate('scan') }, 180)
  }

  const summary = data?.summary ?? {}
  const quickStats = [
    { label: 'Credit Out', value: money(summary.creditOut ?? 0), sub: `${summary.creditCustomerCount ?? 0} customers`, icon: '🔴' },
    { label: 'Stock Value', value: money(summary.inventoryValue ?? 0), sub: `${summary.activeSkuCount ?? 0} SKUs`, icon: '📦' },
    { label: 'Low Stock', value: `${summary.lowStockCount ?? 0} items`, sub: 'Need reorder', icon: '⚠️' },
    { label: 'Transactions', value: String(summary.todayTransactionCount ?? 0), sub: 'Today', icon: '🧾' },
  ]
  const stats = [
    { label: "Today's Sales", value: money(summary.todayRevenue ?? 0), sub: `${summary.todayTransactionCount ?? 0} transactions`, icon: '📈', bg: 'linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)' },
    { label: "Today's Net Profit", value: money(summary.todayProfit ?? 0), sub: `${summary.profitMarginPercentage ?? 0}% margin · ${money(summary.todayExpenseTotal ?? 0)} expenses`, icon: '💰', bg: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)' },
    { label: 'Cash in Till', value: money(summary.cashInTill ?? 0), sub: 'Open sessions', icon: '💵', bg: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)' },
    { label: 'M-Pesa Sales', value: money(data?.paymentBreakdown?.MPESA?.amount ?? 0), sub: `${data?.paymentBreakdown?.MPESA?.transactions ?? 0} transactions`, icon: '📱', bg: 'linear-gradient(135deg, #005F2E 0%, #00A651 100%)' },
  ]
  const topProducts = (data?.topProducts ?? []).map(product => ({ ...product, sold: product.units, revenueLabel: money(product.revenue), change: 'Today' }))
  const timeZone = data?.metadata.timezone ?? 'Africa/Nairobi'
  const recentTransactions = [...(data?.recentTransactions ?? [])]
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .map(transaction => ({ ...transaction, amountLabel: money(transaction.amount), timeLabel: relativeTimeLabel(transaction.time, timeZone) }))
  const recentScans = [...(data?.scanActivity.recent ?? [])]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(scan => ({ ...scan, timeLabel: relativeTimeLabel(scan.createdAt, timeZone) }))

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)', padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
              {data?.metadata.date ?? 'Loading dashboard…'}
            </div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>{data?.metadata.name ?? 'MobiDuka Store'}</div>
            <div style={{ color: 'rgba(212,175,55,0.9)', fontSize: 12, fontWeight: 500, marginTop: 2 }}>{data?.metadata.branch ?? data?.metadata.country ?? 'Kenya'} · Live data</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('notifications')} aria-label="Open notifications" style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadNotifications > 0 && <div style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px', background: '#D32F2F', borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800 }}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</div>}
            </button>
            <button className="btn" onClick={() => onNavigate('more')} style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Quick stats strip — auto-scrolls, pauses on hover/touch */}
        <div ref={statsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {quickStats.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px',
              flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px 16px 80px' }}>
        {error && <div style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}
        {/* Main stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {stats.map((s, i) => (
            <div key={i} className="btn card" style={{ padding: '16px', background: s.bg, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -8, top: -8, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'New Sale', icon: '🛒', color: '#123A8F', screen: 'pos' },
              { label: 'Add Stock', icon: '📦', color: '#2E7D32', screen: 'inventory' },
              { label: 'Add Expense', icon: '💸', color: '#D32F2F', screen: 'more' },
              { label: 'View Report', icon: '📊', color: '#D4AF37', screen: 'reports' },
            ].map((a, i) => (
              <button key={i} className="btn" onClick={() => onNavigate(a.screen)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 6px', borderRadius: 14,
                background: c.tint(a.color), border: 'none', cursor: 'pointer', fontFamily: 'inherit'
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20
                }}>{a.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: a.color, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Top Selling Today</div>
            <button className="btn" onClick={() => onNavigate('reports')} style={{ background: 'none', border: 'none', color: '#123A8F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>See all</button>
          </div>
          {topProducts.length === 0 ? (
            <div style={{ padding: '16px 4px 4px', color: c.muted, fontSize: 12, textAlign: 'center' }}>
              No completed sales recorded today.
            </div>
          ) : topProducts.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < topProducts.length - 1 ? c.divider : 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'linear-gradient(135deg, #123A8F, #1A4FBF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{p.sold} units sold</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{p.revenueLabel}</div>
                  <div style={{ fontSize: 11, color: c.muted, fontWeight: 600 }}>{p.change}</div>
                </div>
              </div>
            ))}
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Recent Transactions</div>
            <button className="btn" onClick={() => onNavigate('reports')} style={{ background: 'none', border: 'none', color: '#123A8F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View all</button>
          </div>
          {recentTransactions.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < recentTransactions.length - 1 ? c.divider : 'none' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: t.method === 'M-Pesa' ? c.successBg : t.method === 'Credit' ? c.errorBg : c.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
              }}>
                {t.method === 'M-Pesa' ? '📱' : t.method === 'Credit' ? '📝' : '💵'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{t.customer}</div>
                <div style={{ fontSize: 11, color: c.muted }}>{t.items} items · {t.timeLabel}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{t.amountLabel}</div>
                <span className={`badge ${t.method === 'M-Pesa' ? 'badge-success' : t.method === 'Credit' ? 'badge-error' : 'badge-blue'}`} style={{ marginTop: 3 }}>{t.method}</span>
              </div>
            </div>
          ))}
        </div>

        {/* SmartScan Widget */}
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <line x1="7" y1="12" x2="17" y2="12"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>SmartScan™</span>
                <span style={{ background: 'rgba(212,175,55,0.25)', border: '1px solid rgba(212,175,55,0.45)', borderRadius: 100, padding: '1px 8px', fontSize: 9, fontWeight: 700, color: '#D4AF37', letterSpacing: 0.5 }}>QUICK ACTION</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>Scan any product barcode instantly</div>
            </div>
            <button className="btn" onClick={handleScanTap} style={{
              background: scanPulse ? '#D4AF37' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
              border: 'none', borderRadius: 12, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, color: '#0D1B3D',
              cursor: 'pointer', fontFamily: 'inherit',
              transform: scanPulse ? 'scale(0.95)' : 'scale(1)',
              transition: 'all 0.15s',
            }}>Scan</button>
          </div>

          {/* Today's Activity */}
          <div style={{ padding: '12px 16px', display: 'flex', gap: 0, borderBottom: c.divider }}>
              {[
              { val: String(data?.scanActivity.counts.FOUND ?? 0), label: 'Barcodes', color: '#123A8F' },
              { val: String(data?.scanActivity.counts.UNKNOWN ?? 0), label: 'Unknown', color: '#D32F2F' },
              { val: String(data?.scanActivity.counts.MANUAL ?? 0), label: 'Manual', color: c.muted },
            ].map((s, i, arr) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? c.divider : 'none', padding: '2px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: c.muted, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent Scans */}
          <div style={{ padding: '10px 16px 4px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Recent Scans</div>
            {recentScans.map((s, i) => (
              <button key={i} className="btn" onClick={() => onNavigate('scan')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < recentScans.length - 1 ? c.divider : 'none', background: 'none', border: 'none', borderBottomWidth: i < recentScans.length - 1 ? 1 : 0, borderBottomColor: c.border, borderBottomStyle: 'solid', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: s.status === 'UNKNOWN' ? c.errorBg : c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{s.emoji ?? '📦'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: s.status === 'UNKNOWN' ? '#C62828' : c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: c.muted, fontFamily: 'monospace' }}>{s.barcode}</div>
                </div>
                <div style={{ fontSize: 10, color: c.faint, flexShrink: 0 }}>{s.timeLabel}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div style={{ background: c.isDark ? 'rgba(249,168,37,0.12)' : 'linear-gradient(135deg, #FFF8E1, #FFFDE7)', border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 20 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#FFD54F' : '#5D4037' }}>{summary.lowStockCount ?? 0} Items Low on Stock</div>
              <div style={{ fontSize: 11, color: c.isDark ? '#F9A825' : '#8D6E63' }}>
                {(summary.lowStockCount ?? 0) > 0 ? 'Action needed before end of day' : 'All monitored stock levels are healthy'}
              </div>
            </div>
            <button className="btn" onClick={() => onNavigate('inventory')} style={{
              marginLeft: 'auto', background: '#F9A825', border: 'none',
              borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              color: 'white', cursor: 'pointer', fontFamily: 'inherit'
            }}>View</button>
          </div>
          {(data?.lowStockItems ?? []).slice(0, 3).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i > 0 ? `1px solid ${c.isDark ? 'rgba(249,168,37,0.15)' : 'rgba(0,0,0,0.06)'}` : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F9A825', flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: c.isDark ? '#FFD54F' : '#5D4037', flex: 1 }}>{item.name}</div>
              <span className="badge badge-warning">{item.quantity} left</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
