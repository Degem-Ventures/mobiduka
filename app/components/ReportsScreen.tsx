import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, ReferenceLine,
} from 'recharts'
import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type WeekPoint = { day: string; sales: number; profit: number; future: boolean; isToday: boolean }
type MonthPoint = { month: string; sales: number; profit: number; future: boolean; isNow: boolean }
type CategoryPoint = { name: string; value: number; revenue: number; color: string }
type ReportsData = {
  summary: { todaySales: number; weekSales: number; weekProfit: number; weekExpenses: number; avgMargin: number; currentMonth: string; year: number; daysInMonth: number; currentDay: number; bestMonth: string }
  trends: WeekPoint[]
  monthly: MonthPoint[]
  categories: Array<{ name: string; value: number; revenue: number }>
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const WeekTip = ({ active, payload, label, data }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; data: WeekPoint[] }) => {
  if (!active || !payload?.length) return null
  const d = data.find(x => x.day === label)
  if (d?.future) return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99' }}>{label} — upcoming</div>
      <div style={{ fontSize: 11, color: '#B0BAD3', marginTop: 2 }}>No data yet</div>
    </div>
  )
  return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>{label}{d?.isToday ? ' · Today' : ''}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#123A8F' : '#D4AF37' }}>
          KSh {p.value.toLocaleString()}
        </div>
      ))}
    </div>
  )
}

const MonthTip = ({ active, payload, label, data, year }: { active?: boolean; payload?: { value: number }[]; label?: string; data: MonthPoint[]; year: number }) => {
  if (!active || !payload?.length) return null
  const d = data.find(x => x.month === label)
  if (d?.future) return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99' }}>{label} {year} — upcoming</div>
      <div style={{ fontSize: 11, color: '#B0BAD3', marginTop: 2 }}>No data yet</div>
    </div>
  )
  return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 2 }}>{label} {year}{d?.isNow ? ' · Current' : ''}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#123A8F' }}>KSh {payload[0].value.toLocaleString()}</div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { onNavigate: (s: string) => void }

export default function ReportsScreen({ onNavigate }: Props) {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'profit'>('daily')
  const [report, setReport] = useState<ReportsData | null>(null)
  const [error, setError] = useState('')
  const c = useColors()

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setError('Please sign in to load reports.'); return }
    apiFetch<ReportsData>(`/api/reports/summary?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(setReport)
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load reports.'))
  }, [])

  const weekData = report?.trends ?? []
  const monthData = report?.monthly ?? []
  const categoryData: CategoryPoint[] = (report?.categories ?? []).map((category, index) => ({ ...category, color: ['#123A8F', '#D4AF37', '#2E7D32', '#D32F2F', '#6B7A99'][index % 5] }))
  const todayLabel = weekData.find(d => d.isToday)?.day ?? 'Today'
  const curMonthLabel = report?.summary.currentMonth ?? 'Current month'
  const year = report?.summary.year ?? new Date().getFullYear()
  const todaySales = report?.summary.todaySales ?? 0
  const weekSales = report?.summary.weekSales ?? 0
  const weekProfit = report?.summary.weekProfit ?? 0
  const avgMargin = (report?.summary.avgMargin ?? 0).toFixed(1)
  const daysInMonth = report?.summary.daysInMonth ?? 0
  const currentDay = report?.summary.currentDay ?? 0
  const weekExpenses = report?.summary.weekExpenses ?? 0
  const maxWeekSales = Math.max(...weekData.map(day => day.sales), 1)
  const maxMonthSales = Math.max(...monthData.map(month => month.sales), 1)

  if (error) return <div className="screen" style={{ background: c.bg, padding: 24, color: '#D32F2F' }}>{error}</div>

  return (
    <div className="screen" style={{ background: c.bg }}>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <button className="btn" onClick={() => onNavigate('more')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Reports & Analytics</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 }}>
              Week of {curMonthLabel} {year} · Up to {todayLabel}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(46,125,50,0.28)', borderRadius: 100, padding: '4px 10px', border: '1px solid rgba(76,175,80,0.4)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#81C784' }}>LIVE</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: "Today's Sales",  value: `KSh ${(todaySales / 1000).toFixed(0)}K`,  color: 'white',    sub: todayLabel },
            { label: 'Week Sales',     value: `KSh ${(weekSales  / 1000).toFixed(0)}K`,  color: '#D4AF37',  sub: `Mon – ${todayLabel}` },
            { label: 'Avg Margin',     value: `${avgMargin}%`,                            color: '#4CAF50',  sub: 'This week' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9,  color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background: c.card, borderBottom: c.divider, display: 'flex', flexShrink: 0 }}>
        {[['daily','Daily'],['monthly','Monthly'],['profit','Profit']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setTab(key as typeof tab)} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: tab === key ? '2px solid #123A8F' : '2px solid transparent',
            color: tab === key ? '#123A8F' : c.muted, fontSize: 13, fontWeight: 600,
          }}>{label}</button>
        ))}
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>

        {/* ══ DAILY ══ */}
        {tab === 'daily' && (
          <>
            {/* Weekly area chart */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Sales & Profit — This Week</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>KSh · data through {todayLabel} · future days dimmed</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weekData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#123A8F" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#123A8F" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7A99' }} axisLine={false} tickLine={false}
                    tickFormatter={d => {
                      const entry = weekData.find(x => x.day === d)
                      return entry?.isToday ? `${d}●` : d
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<WeekTip data={weekData} />} />
                  <ReferenceLine x={todayLabel} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Today', fontSize: 9, fill: '#D4AF37', position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="sales"  stroke="#123A8F" strokeWidth={2} fill="url(#salesGrad)"  dot={false} />
                  <Area type="monotone" dataKey="profit" stroke="#D4AF37" strokeWidth={2} fill="url(#profitGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, justifyContent: 'center' }}>
                {[['#123A8F','Sales'],['#D4AF37','Profit']].map(([clr,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: clr }} />
                    <div style={{ fontSize: 11, color: c.muted }}>{l}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 14, borderTop: '2px dashed #D4AF37' }} />
                  <div style={{ fontSize: 11, color: c.muted }}>Today</div>
                </div>
              </div>
            </div>

            {/* Day-by-day breakdown bars */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Daily Breakdown</div>
              {weekData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 6 ? 10 : 0 }}>
                  <div style={{ width: 38, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                    fontWeight: d.isToday ? 800 : 600,
                    color: d.isToday ? '#123A8F' : d.future ? '#C8D0E0' : c.muted }}>
                    {d.day}
                    {d.isToday && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4AF37', flexShrink: 0 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: '#F0F3F9', borderRadius: 3, overflow: 'hidden' }}>
                      {!d.future && (
                        <div style={{
                          width: `${(d.sales / maxWeekSales) * 100}%`, height: '100%', borderRadius: 3,
                          background: d.isToday
                            ? 'linear-gradient(90deg, #D4AF37, #F0D060)'
                            : 'linear-gradient(90deg, #123A8F, #1A4FBF)',
                        }} />
                      )}
                    </div>
                  </div>
                  <div style={{ width: 65, textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: d.future ? '#C8D0E0' : c.text }}>
                    {d.future ? '—' : `KSh ${(d.sales / 1000).toFixed(0)}K`}
                  </div>
                  <div style={{ width: 42, textAlign: 'right', fontSize: 11, fontWeight: 600,
                    color: d.future ? '#C8D0E0' : '#2E7D32' }}>
                    {d.future ? '' : `${d.sales > 0 ? Math.round(d.profit / d.sales * 100) : 0}%`}
                  </div>
                </div>
              ))}
            </div>

            {/* Category pie */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 16 }}>Sales by Category</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PieChart width={120} height={120}>
                  <Pie data={categoryData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={2} stroke="white">
                    {categoryData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1 }}>
                  {categoryData.map((cat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: c.text, flex: 1 }}>{cat.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>{cat.value.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ MONTHLY ══ */}
        {tab === 'monthly' && (
          <>
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>Monthly Sales {year}</div>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 14 }}>
                KSh · data through {curMonthLabel} · remaining months empty
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9,  fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<MonthTip data={monthData} year={year} />} />
                  <ReferenceLine x={curMonthLabel} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Now', fontSize: 9, fill: '#D4AF37', position: 'insideTopRight' }} />
                  <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                    {monthData.map((m, idx) => (
                      <Cell key={idx}
                        fill={m.future ? '#EDF0F7' : m.isNow ? '#D4AF37' : '#123A8F'}
                        fillOpacity={m.future ? 0.5 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                {[['#123A8F','Past'],['#D4AF37','Current'],['#EDF0F7','Upcoming']].map(([clr,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: clr, border: l === 'Upcoming' ? '1px solid #D0D7E8' : 'none' }} />
                    <div style={{ fontSize: 10, color: c.muted }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Month list */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Monthly Breakdown</div>
              {monthData.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 11 ? 10 : 0 }}>
                  <div style={{ width: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                    fontWeight: m.isNow ? 800 : 600,
                    color: m.isNow ? '#D4AF37' : m.future ? '#C8D0E0' : c.muted }}>
                    {m.month}
                    {m.isNow && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37', flexShrink: 0 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: '#F0F3F9', borderRadius: 3, overflow: 'hidden' }}>
                      {!m.future && (
                        <div style={{
                          width: `${(m.sales / maxMonthSales) * 100}%`, height: '100%', borderRadius: 3,
                          background: m.isNow
                            ? 'linear-gradient(90deg, #D4AF37, #F0D060)'
                            : 'linear-gradient(90deg, #123A8F, #1A4FBF)',
                        }} />
                      )}
                    </div>
                  </div>
                  <div style={{ width: 72, textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: m.future ? '#C8D0E0' : c.text }}>
                    {m.future ? '—' : `KSh ${m.sales.toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary cards */}
            {[
              { label: 'Best Month (so far)', value: report?.summary.bestMonth ?? '—', sub: 'Database revenue leader', icon: '🏆', color: '#D4AF37' },
              { label: 'YTD Revenue', value: `KSh ${monthData.reduce((s, m) => s + m.sales, 0).toLocaleString()}`, sub: 'Current calendar year', icon: '📈', color: '#2E7D32' },
              { label: `Days left in ${curMonthLabel}`, value: `${daysInMonth - currentDay} days`, sub: `${currentDay} of ${daysInMonth} elapsed`, icon: '📅', color: '#123A8F' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(s.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: c.muted }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ══ PROFIT ══ */}
        {tab === 'profit' && (
          <>
            {/* Weekly profit bars */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>Profit This Week</div>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 12 }}>KSh · through {todayLabel} · future days empty</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9,  fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<WeekTip data={weekData} />} />
                  <ReferenceLine x={todayLabel} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Today', fontSize: 9, fill: '#D4AF37', position: 'insideTopRight' }} />
                  <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                    {weekData.map((d, idx) => (
                      <Cell key={idx}
                        fill={d.future ? '#EDF0F7' : d.isToday ? '#D4AF37' : '#2E7D32'}
                        fillOpacity={d.future ? 0.5 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                {[['#2E7D32','Profit'],['#D4AF37','Today'],['#EDF0F7','Upcoming']].map(([clr,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: clr, border: l === 'Upcoming' ? '1px solid #D0D7E8' : 'none' }} />
                    <div style={{ fontSize: 10, color: c.muted }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* P&L summary */}
            {[
              { label: 'Gross Profit (week to date)', value: `KSh ${weekProfit.toLocaleString()}`,                          margin: `${avgMargin}%`, color: '#2E7D32',  err: false },
              { label: 'Operating Expenses',          value: `KSh ${weekExpenses.toLocaleString()}`,                       margin: weekSales > 0 ? `${((weekExpenses / weekSales) * 100).toFixed(1)}%` : '0.0%', color: '#D32F2F',  err: true  },
              { label: 'Net Profit (week to date)',   value: `KSh ${(weekProfit - weekExpenses).toLocaleString()}`,       margin: `${(weekSales > 0 ? ((weekProfit - weekExpenses) / weekSales) * 100 : 0).toFixed(1)}%`, color: '#123A8F', err: false },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: c.muted }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                </div>
                <span className={`badge ${s.err ? 'badge-error' : 'badge-success'}`} style={{ fontSize: 13, padding: '5px 12px' }}>{s.margin}</span>
              </div>
            ))}

            {/* Monthly profit area */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>Monthly Profit {year}</div>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 12 }}>KSh · future months empty</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={monthData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="mProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2E7D32" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9,  fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<MonthTip data={monthData} year={year} />} />
                  <ReferenceLine x={curMonthLabel} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Now', fontSize: 9, fill: '#D4AF37', position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="profit" stroke="#2E7D32" strokeWidth={2} fill="url(#mProfitGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
