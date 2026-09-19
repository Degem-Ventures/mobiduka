import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Expense = { id: string; description: string; category: string | null; amount: number; createdAt: string; paymentMethod: string | null; icon: string | null; recurring: boolean }

const categoryColors: Record<string, string> = {
  Utilities: '#0288D1', Payroll: '#5E35B1', Rent: '#2E7D32', Supplies: '#F57C00', Logistics: '#D32F2F'
}

const normalizeCategory = (category: string | null) => {
  const value = category?.trim() ?? ''
  const known = Object.keys(categoryColors).find(option => option.toLowerCase() === value.toLowerCase())
  return known ?? (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Uncategorized')
}

const getExpenseMethod = (expense: Expense) => {
  if (expense.paymentMethod) return expense.paymentMethod
  const text = `${expense.description} ${expense.category ?? ''}`.toLowerCase()
  if (text.includes('rent') || text.includes('salary') || text.includes('payroll') || text.includes('nhif')) return 'Bank'
  if (text.includes('electric') || text.includes('water') || text.includes('utilit') || text.includes('internet') || text.includes('data')) return 'M-Pesa'
  return 'Cash'
}

const getExpenseIcon = (expense: Expense) => {
  if (expense.icon) return expense.icon
  const text = `${expense.description} ${expense.category ?? ''}`.toLowerCase()
  if (text.includes('rent')) return '🏪'
  if (text.includes('salary') || text.includes('payroll') || text.includes('nhif')) return '👥'
  if (text.includes('transport') || text.includes('delivery')) return '🚚'
  if (text.includes('clean')) return '🧹'
  if (text.includes('packag') || text.includes('suppl')) return '🛍️'
  if (text.includes('internet') || text.includes('data')) return '📶'
  if (text.includes('electric') || text.includes('water') || text.includes('utilit')) return '⚡'
  return '💸'
}

interface Props { onNavigate: (s: string) => void }

export default function ExpensesScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [cat, setCat] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ desc: '', amount: '', category: 'Utilities', categoryOther: '', method: 'Cash', date: new Date().toISOString().slice(0, 10), recurring: false })
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadExpenses = async () => {
    if (!session) { setDataError('Please sign in to load expenses.'); return }
    try {
      setDataError('')
      const rows = await apiFetch<Expense[]>(`/api/expenses?businessId=${encodeURIComponent(session.user.businessId)}`)
      setExpenses(rows)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load expenses.') }
  }

  useEffect(() => { void loadExpenses() }, [session?.user.businessId])

  const saveExpense = async () => {
    if (!session || !form.desc.trim() || !form.amount) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          businessId: session.user.businessId,
          userId: session.user.id,
          description: form.desc.trim(),
          amount: Number(form.amount),
          category: form.category === 'Other' ? form.categoryOther.trim() : form.category,
          paymentMethod: form.method,
          recurring: form.recurring,
          date: form.date,
        }),
      })
      await loadExpenses()
      setForm({ desc: '', amount: '', category: 'Utilities', categoryOther: '', method: 'Cash', date: new Date().toISOString().slice(0, 10), recurring: false })
      setShowAdd(false)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to save expense.') }
    finally { setSaving(false) }
  }

  const categories = ['All', ...Array.from(new Set(expenses.map(expense => normalizeCategory(expense.category))))]
  const filtered = expenses.filter(e => cat === 'All' || normalizeCategory(e.category) === cat)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const now = new Date()
  const monthTotal = expenses
    .filter(expense => {
      const date = new Date(expense.createdAt)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    })
    .reduce((s, e) => s + e.amount, 0)

  if (showAdd) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Expense</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          {dataError && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Description *</label>
              <input className="input" placeholder="e.g. Electricity Bill" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Amount (KSh) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Category *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: form.category === 'Other' ? 10 : 0 }}>
                {['Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics', 'Other'].map(catOpt => (
                  <button key={catOpt} className="btn" onClick={() => setForm(f => ({ ...f, category: catOpt }))} style={{ padding: '7px 14px', borderRadius: 100, border: form.category === catOpt ? 'none' : '1.5px solid #E8ECF4', background: form.category === catOpt ? '#123A8F' : c.card, color: form.category === catOpt ? 'white' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{catOpt}</button>
                ))}
              </div>
              {form.category === 'Other' && (
                <div style={{ marginTop: 10 }}>
                  <input className="input" placeholder="Specify category (e.g. Marketing, Insurance…)" value={form.categoryOther} onChange={e => setForm(f => ({ ...f, categoryOther: e.target.value }))} />
                </div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Cash', 'M-Pesa', 'Bank'].map(m => (
                  <button key={m} className="btn" onClick={() => setForm(f => ({ ...f, method: m }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: form.method === m ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: form.method === m ? 'rgba(18,58,143,0.08)' : c.card, color: form.method === m ? '#123A8F' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: c.cardAlt, borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Recurring Expense</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Repeats monthly</div>
              </div>
              <button className="btn" onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))} style={{ width: 46, height: 26, borderRadius: 13, background: form.recurring ? '#123A8F' : '#D0D7E8', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: form.recurring ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>
          <button className="btn" disabled={saving || !form.desc.trim() || !form.amount || (form.category === 'Other' && !form.categoryOther.trim())} onClick={() => void saveExpense()} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(211,47,47,0.35)', opacity: saving ? 0.7 : 1 }}>
            Save Expense
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
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
          {categories.map(catOpt => (
            <button key={catOpt} className="btn" onClick={() => setCat(catOpt)} style={{ padding: '6px 14px', borderRadius: 100, border: 'none', background: cat === catOpt ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: cat === catOpt ? '#0D1B3D' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{catOpt}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
          {dataError && <div style={{ margin: 12, marginBottom: 0, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 8, letterSpacing: 0.4 }}>
          {cat === 'All' ? 'All Expenses' : cat} · KSh {total.toLocaleString()}
        </div>
        {filtered.map(e => (
          <div key={e.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(categoryColors[normalizeCategory(e.category)] || '#6B7A99'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{getExpenseIcon(e)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{e.description}</div>
                {e.recurring && <span style={{ fontSize: 9, background: c.iconBg, color: '#123A8F', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>RECURRING</span>}
              </div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{normalizeCategory(e.category)} · {getExpenseMethod(e)} · {new Date(e.createdAt).toLocaleDateString()}</div>
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
