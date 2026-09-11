import { useState } from 'react'

const customers = [
  { id: 1, name: 'Jane Mwangi', phone: '0712 345 678', credit: 3400, purchases: 28, lastVisit: '2h ago', initials: 'JM', color: '#123A8F' },
  { id: 2, name: 'Peter Otieno', phone: '0723 456 789', credit: 5200, purchases: 45, lastVisit: 'Yesterday', initials: 'PO', color: '#2E7D32' },
  { id: 3, name: 'Mary Wanjiku', phone: '0734 567 890', credit: 0, purchases: 32, lastVisit: '3 days ago', initials: 'MW', color: '#D32F2F' },
  { id: 4, name: 'James Kariuki', phone: '0745 678 901', credit: 1800, purchases: 19, lastVisit: '1 week ago', initials: 'JK', color: '#D4AF37' },
  { id: 5, name: 'Grace Achieng', phone: '0756 789 012', credit: 9600, purchases: 67, lastVisit: 'Today', initials: 'GA', color: '#7B1FA2' },
  { id: 6, name: 'David Kamau', phone: '0767 890 123', credit: 0, purchases: 14, lastVisit: '2 weeks ago', initials: 'DK', color: '#F57C00' },
  { id: 7, name: 'Sarah Njeri', phone: '0778 901 234', credit: 2100, purchases: 38, lastVisit: '4 days ago', initials: 'SN', color: '#00796B' },
]

const txHistory = [
  { date: 'Today 14:18', type: 'Sale', amount: 3400, method: 'M-Pesa', items: 8 },
  { date: 'Yesterday', type: 'Credit', amount: 1200, method: 'Credit', items: 4 },
  { date: '5 Jul', type: 'Payment', amount: -2000, method: 'Cash', items: 0 },
  { date: '3 Jul', type: 'Sale', amount: 4800, method: 'Cash', items: 12 },
]

interface Props {
  onNavigate: (s: string) => void
}

export default function CustomersScreen({ onNavigate }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<typeof customers[0] | null>(null)
  const [tab, setTab] = useState<'all' | 'credit'>('all')

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (tab === 'all' || (tab === 'credit' && c.credit > 0))
  )

  const totalCredit = customers.reduce((s, c) => s + c.credit, 0)

  if (selected) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <button className="btn" onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Customer Profile</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: selected.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: 'white' }}>{selected.initials}</div>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{selected.phone}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>Last visit: {selected.lastVisit}</div>
            </div>
          </div>
        </div>

        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Credit', value: `KSh ${selected.credit.toLocaleString()}`, color: selected.credit > 0 ? '#D32F2F' : '#2E7D32' },
              { label: 'Purchases', value: selected.purchases, color: '#123A8F' },
              { label: 'This Month', value: 'KSh 9.2K', color: '#D4AF37' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Credit section */}
          {selected.credit > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', border: '1px solid #EF9A9A', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#B71C1C' }}>Outstanding Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#D32F2F', marginTop: 2 }}>KSh {selected.credit.toLocaleString()}</div>
                </div>
                <button className="btn" style={{ background: '#D32F2F', border: 'none', borderRadius: 12, padding: '10px 16px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Record Payment
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn" onClick={() => onNavigate('pos')} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>New Sale</button>
            <button className="btn" style={{ flex: 1, padding: '12px', background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F', borderRadius: 12, color: '#123A8F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Statement</button>
            <button className="btn" style={{ width: 44, height: 44, padding: '0', background: '#E3EAF8', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>📞</button>
          </div>

          {/* Transaction history */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Transaction History</div>
            {txHistory.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < txHistory.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: t.amount < 0 ? '#E8F5E9' : t.method === 'Credit' ? '#FFEBEE' : '#E3EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {t.amount < 0 ? '✅' : t.method === 'Credit' ? '📋' : t.method === 'M-Pesa' ? '📱' : '💵'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{t.type}{t.items > 0 ? ` · ${t.items} items` : ''}</div>
                  <div style={{ fontSize: 11, color: '#6B7A99' }}>{t.date}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#2E7D32' : '#0D1B3D' }}>
                  {t.amount < 0 ? '-' : ''}KSh {Math.abs(t.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Customers</div>
          <button className="btn" style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 16 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add Customer</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Total Customers</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{customers.length}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Total Credit</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B6B' }}>KSh {totalCredit.toLocaleString()}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Credit Accounts</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD93D' }}>{customers.filter(c => c.credit > 0).length}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
            style={{ width: '100%', padding: '11px 12px 11px 36px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #E8ECF4', display: 'flex', flexShrink: 0 }}>
        {[['all', 'All Customers'], ['credit', 'Credit Accounts']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setTab(key as 'all' | 'credit')} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: tab === key ? '2px solid #123A8F' : '2px solid transparent',
            color: tab === key ? '#123A8F' : '#6B7A99', fontSize: 13, fontWeight: 600
          }}>{label}</button>
        ))}
      </div>

      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {filtered.map(c => (
          <button key={c.id} className="btn card" onClick={() => setSelected(c)} style={{
            width: '100%', marginBottom: 8, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
          }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>{c.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 1 }}>{c.phone} · {c.purchases} purchases</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {c.credit > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#D32F2F' }}>KSh {c.credit.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#D32F2F', marginTop: 1 }}>Credit</div>
                </>
              ) : (
                <span className="badge badge-success">Cleared</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
