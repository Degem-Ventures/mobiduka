import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Customer = { id: string; name: string; phone: string | null; credit: number; purchases: number; lastVisit: string; initials: string; color: string }
type Transaction = { id: string; date: string; type: string; amount: number; method: string; items: number }
type CustomerDetails = Customer & { transactions: Transaction[] }

const avatarColors = ['#123A8F', '#2E7D32', '#D32F2F', '#D4AF37', '#7B1FA2', '#F57C00', '#00796B']

interface Props {
  onNavigate: (s: string) => void
}

export default function CustomersScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerDetails | null>(null)
  const [tab, setTab] = useState<'all' | 'credit'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', note: '' })
  const [addSaved, setAddSaved] = useState(false)
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)

  const mapCustomer = (customer: { id: string; name: string; phone: string | null; creditAccount?: { balance: number } | null; _count?: { sales: number }; sales?: Array<{ createdAt: string }> }): Customer => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    credit: Number(customer.creditAccount?.balance ?? 0),
    purchases: customer._count?.sales ?? 0,
    lastVisit: customer.sales?.[0]?.createdAt ? new Date(customer.sales[0].createdAt).toLocaleDateString() : 'No visits',
    initials: customer.name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase(),
    color: avatarColors[customers.length % avatarColors.length] ?? avatarColors[0],
  })

  const loadCustomers = () => {
    if (!session) { setDataError('Please sign in to load customers.'); return }
    apiFetch<Array<{ id: string; name: string; phone: string | null; creditAccount: { balance: number } | null; _count: { sales: number }; sales: Array<{ createdAt: string }> }>>(`/api/customers?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(rows => setCustomers(rows.map(mapCustomer)))
      .catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load customers.'))
  }

  useEffect(loadCustomers, [session?.user.businessId])

  const handleSelectCustomer = async (customer: Customer) => {
    if (!session) return
    try {
      const details = await apiFetch<{ id: string; name: string; phone: string | null; creditAccount: { balance: number } | null; sales: Array<{ id: string; createdAt: string; total: number; payments: Array<{ amount: number; paymentMethod: { name: string } }>; items: Array<{ quantity: number }> }>; creditEntries: Array<{ id: string; type: string; amount: number; createdAt: string }> }>(`/api/customers?businessId=${encodeURIComponent(session.user.businessId)}&customerId=${customer.id}`)
      const transactions: Transaction[] = [
        ...details.sales.map(sale => ({ id: sale.id, date: new Date(sale.createdAt).toLocaleDateString(), type: 'Sale', amount: sale.total, method: sale.payments[0]?.paymentMethod.name ?? 'Sale', items: sale.items.reduce((total, item) => total + item.quantity, 0) })),
        ...details.creditEntries.map(entry => ({ id: entry.id, date: new Date(entry.createdAt).toLocaleDateString(), type: entry.type === 'PAYMENT' ? 'Payment' : 'Credit', amount: entry.type === 'PAYMENT' ? -entry.amount : entry.amount, method: entry.type === 'PAYMENT' ? 'Credit payment' : 'Credit', items: 0 })),
      ].sort((a, b) => b.date.localeCompare(a.date))
      setSelected({ ...customer, phone: details.phone, credit: Number(details.creditAccount?.balance ?? 0), transactions })
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load customer history.') }
  }

  const handleAddSave = async () => {
    if (!session || !addForm.name.trim()) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/customers', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, name: addForm.name.trim(), phone: addForm.phone.trim() || null }) })
      setAddSaved(true)
      setAddForm({ name: '', phone: '', note: '' })
      loadCustomers()
      setTimeout(() => { setAddSaved(false); setShowAdd(false) }, 1200)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to save customer.') }
    finally { setSaving(false) }
  }

  const recordPayment = async () => {
    if (!session || !selected || selected.credit <= 0) return
    const amount = window.prompt(`Payment amount (outstanding KSh ${selected.credit.toLocaleString()})`)
    if (!amount) return
    setSaving(true)
    try {
      await apiFetch('/api/customers/credit', { method: 'POST', body: JSON.stringify({ action: 'RECORD_PAYMENT', businessId: session.user.businessId, customerId: selected.id, amount, userId: session.user.id }) })
      await handleSelectCustomer(selected)
      loadCustomers()
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to record payment.') }
    finally { setSaving(false) }
  }

  const filtered = customers.filter(cust =>
    cust.name.toLowerCase().includes(search.toLowerCase()) &&
    (tab === 'all' || (tab === 'credit' && cust.credit > 0))
  )

  const totalCredit = customers.reduce((s, cust) => s + cust.credit, 0)

  if (showAdd) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Customer</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          {addSaved && (
            <div style={{ background: c.successBg, border: '1px solid #C8E6C9', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Customer added successfully!</span>
            </div>
          )}
          <div className="card" style={{ padding: '20px' }}>
            {/* Avatar preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white', border: '3px solid #E3EAF8' }}>
                {addForm.name ? addForm.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Full Name *</label>
              <input className="input" placeholder="e.g. Jane Mwangi" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Phone Number</label>
              <input className="input" type="tel" placeholder="e.g. 0712 345 678" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input className="input" placeholder="e.g. Regular customer, prefer M-Pesa" value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button className="btn" disabled={saving || !addForm.name.trim()} onClick={() => void handleAddSave()} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)', opacity: addForm.name.trim() ? 1 : 0.5 }}>
              Save Customer
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{selected.phone ?? 'No phone number'}</div>
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
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{s.label}</div>
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
                <button className="btn" disabled={saving} onClick={() => void recordPayment()} style={{ background: '#D32F2F', border: 'none', borderRadius: 12, padding: '10px 16px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Record Payment
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn" onClick={() => onNavigate('pos')} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>New Sale</button>
            <button className="btn" style={{ flex: 1, padding: '12px', background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F', borderRadius: 12, color: '#123A8F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Statement</button>
            <button className="btn" style={{ width: 44, height: 44, padding: '0', background: c.iconBg, border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>📞</button>
          </div>

          {/* Transaction history */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Transaction History</div>
            {selected.transactions.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < selected.transactions.length - 1 ? c.divider : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: t.amount < 0 ? c.successBg : t.method === 'Credit' ? c.errorBg : c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {t.amount < 0 ? '✅' : t.method === 'Credit' ? '📋' : t.method === 'M-Pesa' ? '📱' : '💵'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{t.type}{t.items > 0 ? ` · ${t.items} items` : ''}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{t.date}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#2E7D32' : c.text }}>
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
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Customers</div>
          </div>
          <button className="btn" onClick={() => setShowAdd(true)} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD93D' }}>{customers.filter(cust => cust.credit > 0).length}</div>
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
      <div style={{ background: c.card, borderBottom: c.divider, display: 'flex', flexShrink: 0 }}>
        {[['all', 'All Customers'], ['credit', 'Credit Accounts']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setTab(key as 'all' | 'credit')} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: tab === key ? '2px solid #123A8F' : '2px solid transparent',
            color: tab === key ? '#123A8F' : c.muted, fontSize: 13, fontWeight: 600
          }}>{label}</button>
        ))}
      </div>

      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {filtered.map(cust => (
          <button key={cust.id} className="btn card" onClick={() => void handleSelectCustomer(cust)} style={{
            width: '100%', marginBottom: 8, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
          }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: cust.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>{cust.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{cust.name}</div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{cust.phone} · {cust.purchases} purchases</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {cust.credit > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#D32F2F' }}>KSh {cust.credit.toLocaleString()}</div>
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
