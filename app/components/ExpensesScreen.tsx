import { useState } from 'react'

const expenses = [
  { id: 1, desc: 'Electricity Bill', category: 'Utilities', amount: 8500, date: '8 Jul 2026', method: 'M-Pesa', icon: '⚡', recurring: true },
  { id: 2, desc: 'Staff Salaries', category: 'Payroll', amount: 75000, date: '7 Jul 2026', method: 'Bank', icon: '👥', recurring: true },
  { id: 3, desc: 'Shop Rent', category: 'Rent', amount: 35000, date: '1 Jul 2026', method: 'Bank', icon: '🏪', recurring: true },
  { id: 4, desc: 'Plastic Bags & Packaging', category: 'Supplies', amount: 2300, date: '6 Jul 2026', method: 'Cash', icon: '🛍️', recurring: false },
  { id: 5, desc: 'Internet & Data', category: 'Utilities', amount: 3500, date: '5 Jul 2026', method: 'M-Pesa', icon: '📶', recurring: true },
  { id: 6, desc: 'Cleaning Supplies', category: 'Supplies', amount: 1200, date: '4 Jul 2026', method: 'Cash', icon: '🧹', recurring: false },
  { id: 7, desc: 'Transport / Delivery', category: 'Logistics', amount: 4500, date: '3 Jul 2026', method: 'Cash', icon: '🚚', recurring: false },
  { id: 8, desc: 'NHIF Deductions', category: 'Payroll', amount: 6400, date: '1 Jul 2026', method: 'Bank', icon: '🏥', recurring: true },
]

const categories = ['All', 'Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics']
const categoryColors: Record<string, string> = {
  Utilities: '#0288D1', Payroll: '#5E35B1', Rent: '#2E7D32', Supplies: '#F57C00', Logistics: '#D32F2F'
}

interface Props { onNavigate: (s: string) => void }

export default function ExpensesScreen({ onNavigate }: Props) {
  const [cat, setCat] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ desc: '', amount: '', category: 'Utilities', method: 'Cash', date: '', recurring: false })

  const filtered = expenses.filter(e => cat === 'All' || e.category === cat)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0)

  if (showAdd) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Expense</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Description *</label>
              <input className="input" placeholder="e.g. Electricity Bill" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Amount (KSh) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Category *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics', 'Other'].map(c => (
                  <button key={c} className="btn" onClick={() => setForm(f => ({ ...f, category: c }))} style={{ padding: '7px 14px', borderRadius: 100, border: form.category === c ? 'none' : '1.5px solid #E8ECF4', background: form.category === c ? '#123A8F' : 'white', color: form.category === c ? 'white' : '#6B7A99', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Cash', 'M-Pesa', 'Bank'].map(m => (
                  <button key={m} className="btn" onClick={() => setForm(f => ({ ...f, method: m }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: form.method === m ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: form.method === m ? 'rgba(18,58,143,0.08)' : 'white', color: form.method === m ? '#123A8F' : '#6B7A99', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Date</label>
              <input className="input" type="date" defaultValue="2026-07-08" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#F5F7FA', borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>Recurring Expense</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 2 }}>Repeats monthly</div>
              </div>
              <button className="btn" onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))} style={{ width: 46, height: 26, borderRadius: 13, background: form.recurring ? '#123A8F' : '#D0D7E8', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: form.recurring ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>
          <button className="btn" onClick={() => setShowAdd(false)} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(211,47,47,0.35)' }}>
            Save Expense
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Expense Tracking</div>
          </div>
          <button className="btn" onClick={() => setShowAdd(true)} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add</span>
          </button>
        </div>
        <div style={{ background: 'rgba(211,47,47,0.2)', border: '1px solid rgba(239,154,154,0.3)', borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Total Expenses This Month</div>
          <div style={{ color: '#FF6B6B', fontSize: 28, fontWeight: 900, marginTop: 2 }}>KSh {monthTotal.toLocaleString()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(c => (
            <button key={c} className="btn" onClick={() => setCat(c)} style={{ padding: '6px 14px', borderRadius: 100, border: 'none', background: cat === c ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: cat === c ? '#0D1B3D' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{c}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', marginBottom: 8, letterSpacing: 0.4 }}>
          {cat === 'All' ? 'All Expenses' : cat} · KSh {total.toLocaleString()}
        </div>
        {filtered.map(e => (
          <div key={e.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${(categoryColors[e.category] || '#6B7A99')}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{e.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>{e.desc}</div>
                {e.recurring && <span style={{ fontSize: 9, background: '#E3EAF8', color: '#123A8F', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>RECURRING</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 2 }}>{e.category} · {e.method} · {e.date}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#D32F2F', flexShrink: 0 }}>KSh {e.amount.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 80, right: 16 }}>
        <button className="btn" onClick={() => setShowAdd(true)} style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', fontSize: 24, color: 'white', boxShadow: '0 4px 16px rgba(211,47,47,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
    </div>
  )
}
