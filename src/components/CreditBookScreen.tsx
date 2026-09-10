import { useState } from 'react'

const credits = [
  { id: 1, customer: 'Peter Otieno', phone: '0723 456 789', balance: 5200, lastTx: '8 Jul 2026', txCount: 4, initials: 'PO', color: '#2E7D32', daysOld: 1 },
  { id: 2, customer: 'Grace Achieng', phone: '0756 789 012', balance: 9600, lastTx: '8 Jul 2026', txCount: 7, initials: 'GA', color: '#7B1FA2', daysOld: 0 },
  { id: 3, customer: 'Jane Mwangi', phone: '0712 345 678', balance: 3400, lastTx: '7 Jul 2026', txCount: 2, initials: 'JM', color: '#123A8F', daysOld: 1 },
  { id: 4, customer: 'James Kariuki', phone: '0745 678 901', balance: 1800, lastTx: '5 Jul 2026', txCount: 1, initials: 'JK', color: '#D4AF37', daysOld: 3 },
  { id: 5, customer: 'Sarah Njeri', phone: '0778 901 234', balance: 2100, lastTx: '4 Jul 2026', txCount: 3, initials: 'SN', color: '#00796B', daysOld: 4 },
]

const txHistory = [
  { date: '8 Jul 14:18', desc: 'Sale on credit', amount: 1200, type: 'credit' },
  { date: '8 Jul 09:05', desc: 'Sale on credit', amount: 800, type: 'credit' },
  { date: '7 Jul 16:30', desc: 'Cash payment received', amount: 2000, type: 'payment' },
  { date: '6 Jul 11:20', desc: 'Sale on credit', amount: 1500, type: 'credit' },
  { date: '5 Jul 10:00', desc: 'M-Pesa payment', amount: 1000, type: 'payment' },
]

interface Props { onNavigate: (s: string) => void }

export default function CreditBookScreen({ onNavigate }: Props) {
  const [selected, setSelected] = useState<typeof credits[0] | null>(null)
  const [showRecord, setShowRecord] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'mpesa'>('cash')

  const total = credits.reduce((s, c) => s + c.balance, 0)

  if (selected && showRecord) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <button className="btn" onClick={() => setShowRecord(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Record Payment</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{selected.customer}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>Outstanding Balance</div>
            <div style={{ color: 'white', fontSize: 36, fontWeight: 900, marginTop: 4 }}>KSh {selected.balance.toLocaleString()}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Payment Amount (KSh)</label>
              <input className="input" type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                style={{ fontSize: 28, fontWeight: 800, color: '#0D1B3D', textAlign: 'center', padding: '16px' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[1000, 2000, selected.balance].map(v => (
                  <button key={v} className="btn" onClick={() => setPayAmount(String(v))} style={{ flex: 1, padding: '8px', background: '#E3EAF8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v === selected.balance ? 'Full' : `KSh ${v.toLocaleString()}`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 8 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ key: 'cash', label: '💵 Cash' }, { key: 'mpesa', label: '📱 M-Pesa' }].map(m => (
                  <button key={m.key} className="btn" onClick={() => setPayMethod(m.key as 'cash' | 'mpesa')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: payMethod === m.key ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: payMethod === m.key ? 'rgba(18,58,143,0.08)' : 'white', fontSize: 14, fontWeight: 600, color: payMethod === m.key ? '#123A8F' : '#6B7A99', cursor: 'pointer', fontFamily: 'inherit' }}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn" onClick={() => { setShowRecord(false); setSelected(null) }} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(46,125,50,0.35)' }}>
            Confirm Payment
          </button>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <button className="btn" onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Credit Account</div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: selected.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>{selected.initials}</div>
            <div>
              <div style={{ color: 'white', fontSize: 17, fontWeight: 800 }}>{selected.customer}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{selected.phone}</div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div style={{ background: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', border: '1px solid #EF9A9A', borderRadius: 16, padding: '16px 20px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#B71C1C', marginBottom: 4 }}>Outstanding Balance</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#D32F2F' }}>KSh {selected.balance.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#EF5350', marginTop: 4 }}>{selected.daysOld === 0 ? 'Added today' : `${selected.daysOld} day${selected.daysOld > 1 ? 's' : ''} outstanding`}</div>
          </div>
          <button className="btn" onClick={() => setShowRecord(true)} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, boxShadow: '0 3px 12px rgba(46,125,50,0.3)' }}>
            💰 Record Payment
          </button>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Transaction History</div>
            {txHistory.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < txHistory.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.type === 'payment' ? '#E8F5E9' : '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {t.type === 'payment' ? '✅' : '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{t.desc}</div>
                  <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{t.date}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.type === 'payment' ? '#2E7D32' : '#D32F2F' }}>
                  {t.type === 'payment' ? '-' : '+'}KSh {t.amount.toLocaleString()}
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
        <div style={{ marginBottom: 16 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
          </button>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Credit Book</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(212,47,47,0.3), rgba(183,28,28,0.3))', border: '1px solid rgba(239,154,154,0.3)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Total Outstanding Credit</div>
          <div style={{ color: '#FF6B6B', fontSize: 30, fontWeight: 900, marginTop: 2 }}>KSh {total.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{credits.length} active credit accounts</div>
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {credits.map(c => (
          <button key={c.id} className="btn card" onClick={() => setSelected(c)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>{c.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D' }}>{c.customer}</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{c.phone} · {c.txCount} transactions</div>
              <div style={{ fontSize: 11, color: c.daysOld > 3 ? '#D32F2F' : '#F9A825', fontWeight: 600, marginTop: 2 }}>
                {c.daysOld === 0 ? 'Added today' : `${c.daysOld}d outstanding`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#D32F2F' }}>KSh {c.balance.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 2 }}>Last: {c.lastTx}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
