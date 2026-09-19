import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Transaction = { id: string; date: string; desc: string; amount: number; type: 'credit' | 'payment' }
type Credit = { id: string; customer: string; phone: string | null; balance: number; lastTx: string; txCount: number; initials: string; color: string; daysOld: number; transactions: Transaction[] }

const avatarColors = ['#123A8F', '#2E7D32', '#D32F2F', '#D4AF37', '#7B1FA2', '#F57C00', '#00796B']

interface Props { onNavigate: (s: string) => void }

export default function CreditBookScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [credits, setCredits] = useState<Credit[]>([])
  const [selected, setSelected] = useState<Credit | null>(null)
  const [showRecord, setShowRecord] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'mpesa'>('cash')
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)

  type CustomerSummary = { id: string; name: string; phone: string | null; creditAccount: { balance: number } | null; _count?: { sales: number; creditEntries: number }; creditEntries?: Array<{ id: string; type: string; amount: number; paymentMethod?: string | null; createdAt: string }>; sales?: Array<{ id: string; createdAt: string; total?: number; payments?: Array<{ paymentMethod: { name: string } }>; items?: Array<{ quantity: number }> }> }

  const mapCredit = (customer: CustomerSummary, index: number, transactions: Transaction[] = []): Credit => {
    const latest = transactions[0]
    const lastDate = latest?.date ?? 'No transactions'
    const daysOld = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000)) : 0
    return {
      id: customer.id,
      customer: customer.name,
      phone: customer.phone,
      balance: Number(customer.creditAccount?.balance ?? 0),
      lastTx: lastDate,
      txCount: (customer._count?.sales ?? 0) + (customer._count?.creditEntries ?? 0),
      initials: customer.name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase(),
      color: avatarColors[index % avatarColors.length] ?? avatarColors[0],
      daysOld,
      transactions,
    }
  }

  const toTransactions = (customer: CustomerSummary): Transaction[] => [
    ...(customer.sales ?? []).filter(sale => typeof sale.total === 'number').map(sale => ({ id: sale.id, date: new Date(sale.createdAt).toLocaleString(), desc: 'Sale', amount: sale.total ?? 0, type: 'credit' as const })),
    ...(customer.creditEntries ?? []).map(entry => ({ id: entry.id, date: new Date(entry.createdAt).toLocaleString(), desc: entry.type === 'PAYMENT' ? `${entry.paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash'} payment received` : 'Credit charge', amount: entry.amount, type: entry.type === 'PAYMENT' ? 'payment' as const : 'credit' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const loadCredits = async () => {
    if (!session) { setDataError('Please sign in to load credit accounts.'); return }
    try {
      setDataError('')
      const rows = await apiFetch<CustomerSummary[]>(`/api/customers?businessId=${encodeURIComponent(session.user.businessId)}`)
      setCredits(rows.filter(row => Number(row.creditAccount?.balance ?? 0) > 0).map((row, index) => mapCredit(row, index, toTransactions(row))))
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load credit accounts.') }
  }

  useEffect(() => { void loadCredits() }, [session?.user.businessId])

  const handleSelect = async (credit: Credit) => {
    if (!session) return
    try {
      const details = await apiFetch<CustomerSummary>(`/api/customers?businessId=${encodeURIComponent(session.user.businessId)}&customerId=${encodeURIComponent(credit.id)}`)
      setSelected(mapCredit(details, credits.indexOf(credit), toTransactions(details)))
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load credit history.') }
  }

  const recordPayment = async () => {
    if (!session || !selected) return
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.balance) {
      setDataError('Enter a payment amount within the outstanding balance.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/customers/credit', { method: 'POST', body: JSON.stringify({ action: 'RECORD_PAYMENT', businessId: session.user.businessId, customerId: selected.id, amount, userId: session.user.id, paymentMethod: payMethod.toUpperCase() }) })
      await loadCredits()
      setShowRecord(false)
      setSelected(null)
      setPayAmount('')
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to record payment.') }
    finally { setSaving(false) }
  }

  const total = credits.reduce((s, cr) => s + cr.balance, 0)

  if (selected && showRecord) {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Payment Amount (KSh)</label>
              <input className="input" type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                style={{ fontSize: 28, fontWeight: 800, color: c.text, textAlign: 'center', padding: '16px' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[1000, 2000, selected.balance].map(v => (
                  <button key={v} className="btn" onClick={() => setPayAmount(String(v))} style={{ flex: 1, padding: '8px', background: c.iconBg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v === selected.balance ? 'Full' : `KSh ${v.toLocaleString()}`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ key: 'cash', label: '💵 Cash' }, { key: 'mpesa', label: '📱 M-Pesa' }].map(m => (
                  <button key={m.key} className="btn" onClick={() => setPayMethod(m.key as 'cash' | 'mpesa')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: payMethod === m.key ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: payMethod === m.key ? 'rgba(18,58,143,0.08)' : c.card, fontSize: 14, fontWeight: 600, color: payMethod === m.key ? '#123A8F' : c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn" disabled={saving} onClick={() => void recordPayment()} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(46,125,50,0.35)', opacity: saving ? 0.7 : 1 }}>
            Confirm Payment
          </button>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Transaction History</div>
            {selected.transactions.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < selected.transactions.length - 1 ? c.divider : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.type === 'payment' ? c.successBg : c.errorBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {t.type === 'payment' ? '✅' : '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{t.desc}</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{t.date}</div>
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
    <div className="screen" style={{ background: c.bg }}>
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
      {dataError && <div style={{ margin: 12, marginBottom: 0, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {credits.map(cr => (
          <button key={cr.id} className="btn card" onClick={() => void handleSelect(cr)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: cr.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>{cr.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{cr.customer}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{cr.phone} · {cr.txCount} transactions</div>
              <div style={{ fontSize: 11, color: cr.daysOld > 3 ? '#D32F2F' : '#F9A825', fontWeight: 600, marginTop: 2 }}>
                {cr.daysOld === 0 ? 'Added today' : `${cr.daysOld}d outstanding`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#D32F2F' }}>KSh {cr.balance.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Last: {cr.lastTx}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
