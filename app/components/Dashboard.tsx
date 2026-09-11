interface Props {
  onNavigate: (screen: string) => void
}

const stats = [
  { label: "Today's Sales", value: "KSh 84,250", sub: "+12% vs yesterday", color: '#123A8F', icon: '📈', bg: 'linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)' },
  { label: "Today's Profit", value: "KSh 22,100", sub: "26.2% margin", color: '#2E7D32', icon: '💰', bg: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)' },
  { label: "Cash in Till", value: "KSh 45,800", sub: "Last count: 2h ago", color: '#D4AF37', icon: '💵', bg: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)' },
  { label: "M-Pesa Sales", value: "KSh 38,450", sub: "47 transactions", color: '#00A651', icon: '📱', bg: 'linear-gradient(135deg, #005F2E 0%, #00A651 100%)' },
]

const quickStats = [
  { label: 'Credit Out', value: 'KSh 12,300', sub: '8 customers', icon: '🔴' },
  { label: 'Stock Value', value: 'KSh 312,000', sub: '486 SKUs', icon: '📦' },
  { label: 'Low Stock', value: '12 items', sub: 'Need reorder', icon: '⚠️' },
  { label: 'Transactions', value: '156', sub: 'Today', icon: '🧾' },
]

const topProducts = [
  { name: 'Unga Jogoo 2kg', sold: 42, revenue: 'KSh 8,400', change: '+8%' },
  { name: 'Cooking Oil 1L', sold: 38, revenue: 'KSh 7,220', change: '+15%' },
  { name: 'Sugar 1kg', sold: 35, revenue: 'KSh 4,900', change: '-3%' },
  { name: 'Blue Band 500g', sold: 29, revenue: 'KSh 4,350', change: '+5%' },
  { name: 'Milk 500ml', sold: 27, revenue: 'KSh 2,700', change: '+22%' },
]

const recentTx = [
  { time: '14:32', customer: 'Walk-in', amount: 'KSh 1,250', method: 'Cash', items: 5 },
  { time: '14:18', customer: 'Jane Mwangi', amount: 'KSh 3,400', method: 'M-Pesa', items: 8 },
  { time: '13:55', customer: 'Walk-in', amount: 'KSh 650', method: 'Cash', items: 2 },
  { time: '13:41', customer: 'Peter Otieno', amount: 'KSh 5,200', method: 'Credit', items: 14 },
]

export default function Dashboard({ onNavigate }: Props) {
  return (
    <div className="screen">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)', padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
              Tue, 8 July 2026 · 14:45
            </div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>MobiDuka Store</div>
            <div style={{ color: 'rgba(212,175,55,0.9)', fontSize: 12, fontWeight: 500, marginTop: 2 }}>Nairobi CBD · Shift: Morning</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, background: '#D32F2F', borderRadius: '50%' }} />
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

        {/* Quick stats strip */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Quick Actions</div>
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
                background: `${a.color}14`, border: 'none', cursor: 'pointer', fontFamily: 'inherit'
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
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Top Selling Today</div>
            <button className="btn" onClick={() => onNavigate('reports')} style={{ background: 'none', border: 'none', color: '#123A8F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>See all</button>
          </div>
          {topProducts.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < topProducts.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #123A8F, #1A4FBF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{p.sold} units sold</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3D' }}>{p.revenue}</div>
                <div style={{ fontSize: 11, color: p.change.startsWith('+') ? '#2E7D32' : '#D32F2F', fontWeight: 600 }}>{p.change}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Recent Transactions</div>
            <button className="btn" onClick={() => onNavigate('reports')} style={{ background: 'none', border: 'none', color: '#123A8F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View all</button>
          </div>
          {recentTx.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < recentTx.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: t.method === 'M-Pesa' ? '#E8F5E9' : t.method === 'Credit' ? '#FFEBEE' : '#E3EAF8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
              }}>
                {t.method === 'M-Pesa' ? '📱' : t.method === 'Credit' ? '📝' : '💵'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{t.customer}</div>
                <div style={{ fontSize: 11, color: '#6B7A99' }}>{t.items} items · {t.time}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>{t.amount}</div>
                <span className="badge" style={{ marginTop: 3 }}
                  data-method={t.method}>
                  <span className={`badge ${t.method === 'M-Pesa' ? 'badge-success' : t.method === 'Credit' ? 'badge-error' : 'badge-blue'}`}>{t.method}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Low Stock Alert */}
        <div style={{ background: 'linear-gradient(135deg, #FFF8E1, #FFFDE7)', border: '1px solid #FFE082', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 20 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5D4037' }}>12 Items Low on Stock</div>
              <div style={{ fontSize: 11, color: '#8D6E63' }}>Action needed before end of day</div>
            </div>
            <button className="btn" onClick={() => onNavigate('inventory')} style={{
              marginLeft: 'auto', background: '#F9A825', border: 'none',
              borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              color: 'white', cursor: 'pointer', fontFamily: 'inherit'
            }}>View</button>
          </div>
          {['Panadol 500mg', 'Royco 75g', 'Omo 400g'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F9A825', flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#5D4037', flex: 1 }}>{item}</div>
              <span className="badge badge-warning">{[3, 5, 8][i]} left</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
