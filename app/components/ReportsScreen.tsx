import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, ReferenceLine,
} from 'recharts'
import { useState } from 'react'

// ─── Real-time anchors ────────────────────────────────────────────────────────
const NOW        = new Date()
const JS_DAY     = NOW.getDay()          // 0=Sun … 6=Sat
const MON_IDX    = (JS_DAY + 6) % 7     // Mon=0 … Sun=6
const CUR_MON    = NOW.getMonth()        // 0=Jan … 11=Dec
const CUR_DATE   = NOW.getDate()
const YEAR       = NOW.getFullYear()
const DAYS_IN_MON = new Date(YEAR, CUR_MON + 1, 0).getDate()

// ─── Weekly data — future days keep their shape but are marked "future" ───────
const WEEK_FULL = [
  { day: 'Mon', sales: 62000,  profit: 15500 },
  { day: 'Tue', sales: 84250,  profit: 22100 },
  { day: 'Wed', sales: 71000,  profit: 18200 },
  { day: 'Thu', sales: 95000,  profit: 25400 },
  { day: 'Fri', sales: 110000, profit: 30800 },
  { day: 'Sat', sales: 130000, profit: 38000 },
  { day: 'Sun', sales: 78000,  profit: 20200 },
]

const weekData = WEEK_FULL.map((d, i) => ({
  day:     d.day,
  sales:   i <= MON_IDX ? d.sales  : 0,
  profit:  i <= MON_IDX ? d.profit : 0,
  future:  i >  MON_IDX,
  isToday: i === MON_IDX,
}))

const todayLabel = WEEK_FULL[MON_IDX].day

// ─── Monthly data — future months kept as 0 + flagged ────────────────────────
const MONTH_FULL = [
  { month: 'Jan', sales: 1.80, profit: 0.46 },
  { month: 'Feb', sales: 2.10, profit: 0.54 },
  { month: 'Mar', sales: 2.40, profit: 0.63 },
  { month: 'Apr', sales: 2.00, profit: 0.52 },
  { month: 'May', sales: 2.70, profit: 0.71 },
  { month: 'Jun', sales: 3.10, profit: 0.82 },
  { month: 'Jul', sales: 2.90, profit: 0.76 },
  { month: 'Aug', sales: 3.40, profit: 0.90 },
  { month: 'Sep', sales: 3.00, profit: 0.78 },
  { month: 'Oct', sales: 3.60, profit: 0.95 },
  { month: 'Nov', sales: 3.20, profit: 0.84 },
  { month: 'Dec', sales: 4.10, profit: 1.08 },
]

const monthData = MONTH_FULL.map((d, i) => ({
  month:   d.month,
  sales:   i <= CUR_MON ? d.sales  : 0,
  profit:  i <= CUR_MON ? d.profit : 0,
  future:  i >  CUR_MON,
  isNow:   i === CUR_MON,
}))

const curMonthLabel = MONTH_FULL[CUR_MON].month

// ─── Category breakdown ───────────────────────────────────────────────────────
const categoryData = [
  { name: 'Flour & Grains', value: 28, color: '#123A8F' },
  { name: 'Dairy',          value: 22, color: '#D4AF37' },
  { name: 'Oils & Fats',    value: 18, color: '#2E7D32' },
  { name: 'Pharma',         value: 15, color: '#D32F2F' },
  { name: 'Others',         value: 17, color: '#6B7A99' },
]

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const WeekTip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const d = weekData.find(x => x.day === label)
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

const MonthTip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const d = monthData.find(x => x.month === label)
  if (d?.future) return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99' }}>{label} {YEAR} — upcoming</div>
      <div style={{ fontSize: 11, color: '#B0BAD3', marginTop: 2 }}>No data yet</div>
    </div>
  )
  return (
    <div style={{ background: 'white', border: '1px solid #E8ECF4', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 2 }}>{label} {YEAR}{d?.isNow ? ' · Current' : ''}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#123A8F' }}>KSh {((payload[0].value) * 1000000).toLocaleString()}</div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { onNavigate: (s: string) => void }

export default function ReportsScreen({ onNavigate }: Props) {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'profit'>('daily')

  const todaySales    = weekData.find(d => d.isToday)?.sales  ?? 0
  const weekSales     = weekData.filter(d => !d.future).reduce((s, d) => s + d.sales,  0)
  const weekProfit   = weekData.filter(d => !d.future).reduce((s, d) => s + d.profit, 0)
  const avgMargin    = weekSales > 0 ? ((weekProfit / weekSales) * 100).toFixed(1) : '0'

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <button className="btn" onClick={() => onNavigate('dashboard')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Reports & Analytics</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 }}>
              Week of {curMonthLabel} {YEAR} · Up to {todayLabel}
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
      <div style={{ background: 'white', borderBottom: '1px solid #E8ECF4', display: 'flex', flexShrink: 0 }}>
        {[['daily','Daily'],['monthly','Monthly'],['profit','Profit']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setTab(key as typeof tab)} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: tab === key ? '2px solid #123A8F' : '2px solid transparent',
            color: tab === key ? '#123A8F' : '#6B7A99', fontSize: 13, fontWeight: 600,
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Sales & Profit — This Week</div>
                  <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>KSh · data through {todayLabel} · future days dimmed</div>
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
                  <Tooltip content={<WeekTip />} />
                  <ReferenceLine x={todayLabel} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Today', fontSize: 9, fill: '#D4AF37', position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="sales"  stroke="#123A8F" strokeWidth={2} fill="url(#salesGrad)"  dot={false} />
                  <Area type="monotone" dataKey="profit" stroke="#D4AF37" strokeWidth={2} fill="url(#profitGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, justifyContent: 'center' }}>
                {[['#123A8F','Sales'],['#D4AF37','Profit']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />
                    <div style={{ fontSize: 11, color: '#6B7A99' }}>{l}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 14, borderTop: '2px dashed #D4AF37' }} />
                  <div style={{ fontSize: 11, color: '#6B7A99' }}>Today</div>
                </div>
              </div>
            </div>

            {/* Day-by-day breakdown bars */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Daily Breakdown</div>
              {weekData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 6 ? 10 : 0 }}>
                  <div style={{ width: 38, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                    fontWeight: d.isToday ? 800 : 600,
                    color: d.isToday ? '#123A8F' : d.future ? '#C8D0E0' : '#6B7A99' }}>
                    {d.day}
                    {d.isToday && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4AF37', flexShrink: 0 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: '#F0F3F9', borderRadius: 3, overflow: 'hidden' }}>
                      {!d.future && (
                        <div style={{
                          width: `${(d.sales / 130000) * 100}%`, height: '100%', borderRadius: 3,
                          background: d.isToday
                            ? 'linear-gradient(90deg, #D4AF37, #F0D060)'
                            : 'linear-gradient(90deg, #123A8F, #1A4FBF)',
                        }} />
                      )}
                    </div>
                  </div>
                  <div style={{ width: 65, textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: d.future ? '#C8D0E0' : '#0D1B3D' }}>
                    {d.future ? '—' : `KSh ${(d.sales / 1000).toFixed(0)}K`}
                  </div>
                  <div style={{ width: 42, textAlign: 'right', fontSize: 11, fontWeight: 600,
                    color: d.future ? '#C8D0E0' : '#2E7D32' }}>
                    {d.future ? '' : `${Math.round(d.profit / d.sales * 100)}%`}
                  </div>
                </div>
              ))}
            </div>

            {/* Category pie */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 16 }}>Sales by Category</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PieChart width={120} height={120}>
                  <Pie data={categoryData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={2} stroke="white">
                    {categoryData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1 }}>
                  {categoryData.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: '#0D1B3D', flex: 1 }}>{c.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99' }}>{c.value}%</div>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 4 }}>Monthly Sales {YEAR}</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 14 }}>
                KSh Millions · data through {curMonthLabel} · remaining months empty
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9,  fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<MonthTip />} />
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
                {[['#123A8F','Past'],['#D4AF37','Current'],['#EDF0F7','Upcoming']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c, border: l === 'Upcoming' ? '1px solid #D0D7E8' : 'none' }} />
                    <div style={{ fontSize: 10, color: '#6B7A99' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Month list */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Monthly Breakdown</div>
              {monthData.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 11 ? 10 : 0 }}>
                  <div style={{ width: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                    fontWeight: m.isNow ? 800 : 600,
                    color: m.isNow ? '#D4AF37' : m.future ? '#C8D0E0' : '#6B7A99' }}>
                    {m.month}
                    {m.isNow && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37', flexShrink: 0 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: '#F0F3F9', borderRadius: 3, overflow: 'hidden' }}>
                      {!m.future && (
                        <div style={{
                          width: `${(m.sales / 4.1) * 100}%`, height: '100%', borderRadius: 3,
                          background: m.isNow
                            ? 'linear-gradient(90deg, #D4AF37, #F0D060)'
                            : 'linear-gradient(90deg, #123A8F, #1A4FBF)',
                        }} />
                      )}
                    </div>
                  </div>
                  <div style={{ width: 72, textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: m.future ? '#C8D0E0' : '#0D1B3D' }}>
                    {m.future ? '—' : `KSh ${(m.sales * 1000000).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary cards */}
            {[
              { label: 'Best Month (so far)', value: 'June 2026', sub: 'KSh 3.1M revenue', icon: '🏆', color: '#D4AF37' },
              { label: 'YTD Revenue', value: `KSh ${(monthData.filter(m => !m.future).reduce((s, m) => s + m.sales, 0) * 1000000).toLocaleString()}`, sub: '+18% vs last year', icon: '📈', color: '#2E7D32' },
              { label: `Days left in ${curMonthLabel}`, value: `${DAYS_IN_MON - CUR_DATE} days`, sub: `${CUR_DATE} of ${DAYS_IN_MON} elapsed`, icon: '📅', color: '#123A8F' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7A99' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7A99' }}>{s.sub}</div>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 4 }}>Profit This Week</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 12 }}>KSh · through {todayLabel} · future days empty</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9,  fill: '#6B7A99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<WeekTip />} />
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
                {[['#2E7D32','Profit'],['#D4AF37','Today'],['#EDF0F7','Upcoming']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c, border: l === 'Upcoming' ? '1px solid #D0D7E8' : 'none' }} />
                    <div style={{ fontSize: 10, color: '#6B7A99' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* P&L summary */}
            {[
              { label: 'Gross Profit (week to date)', value: `KSh ${weekProfit.toLocaleString()}`,                          margin: `${avgMargin}%`, color: '#2E7D32',  err: false },
              { label: 'Operating Expenses',          value: 'KSh 33,600',                                                  margin: '5.7%',         color: '#D32F2F',  err: true  },
              { label: 'Net Profit (week to date)',   value: `KSh ${(weekProfit - 33600).toLocaleString()}`,                margin: `${(((weekProfit - 33600) / weekSales) * 100).toFixed(1)}%`, color: '#123A8F', err: false },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7A99' }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                </div>
                <span className={`badge ${s.err ? 'badge-error' : 'badge-success'}`} style={{ fontSize: 13, padding: '5px 12px' }}>{s.margin}</span>
              </div>
            ))}

            {/* Monthly profit area */}
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 4 }}>Monthly Profit {YEAR}</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 12 }}>KSh Millions · future months empty</div>
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
                  <Tooltip content={<MonthTip />} />
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
