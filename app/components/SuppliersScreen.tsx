import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Supplier = { id: string; name: string; category: string | null; contactPerson: string | null; phone: string | null; email: string | null; _count: { purchaseOrders: number; products: number } }

interface Props { onNavigate: (s: string) => void }

export default function SuppliersScreen({ onNavigate }: Props) {
  const c = useColors()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', contact: '', phone: '', email: '' })
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)
  const session = getClientSession()

  useEffect(() => {
    if (!session) { setDataError('Please sign in to load suppliers.'); return }
    apiFetch<Supplier[]>(`/api/suppliers?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(setSuppliers)
      .catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load suppliers.'))
  }, [session?.user.businessId])

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.category ?? '').toLowerCase().includes(search.toLowerCase()))

  if (showAdd) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Supplier</div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: '20px', paddingRight: '16px', paddingLeft: '16px', paddingBottom: 100 }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            {[
              { label: 'Business Name *', key: 'name', placeholder: 'e.g. Unga Limited' },
              { label: 'Category *', key: 'category', placeholder: 'e.g. Flour & Grains' },
              { label: 'Contact Person', key: 'contact', placeholder: 'Full name' },
              { label: 'Phone Number', key: 'phone', placeholder: '+254 ...' },
              { label: 'Email Address', key: 'email', placeholder: 'supplier@email.com' },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button className="btn" disabled={saving} onClick={async () => {
            if (!session || !form.name.trim()) return
            setSaving(true)
            try {
              const supplier = await apiFetch<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, name: form.name, category: form.category, contactPerson: form.contact, phone: form.phone, email: form.email }) })
              setSuppliers(previous => [...previous, supplier])
              setForm({ name: '', category: '', contact: '', phone: '', email: '' })
              setShowAdd(false)
            } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to save supplier.') }
            finally { setSaving(false) }
          }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {saving ? 'Saving...' : 'Save Supplier'}
          </button>
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
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Supplier Profile</div>
            <button className="btn" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: '#123A8F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>{selected.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={{ color: 'white', fontSize: 17, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{selected.category ?? 'General supplier'}</div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: '16px', paddingRight: '16px', paddingLeft: '16px', paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Total Orders', selected._count.purchaseOrders, '#123A8F'], ['Products Supplied', selected._count.products, '#2E7D32']].map(([l, v, col], i) => (
              <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: String(col) }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 12 }}>Contact Information</div>
            {[['Contact Person', selected.contactPerson ?? 'Not provided'], ['Phone', selected.phone ?? 'Not provided'], ['Email', selected.email ?? 'Not provided']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? c.divider : 'none' }}>
                <div style={{ fontSize: 12, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('purchases')} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>New Order</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: '#E8F5E9', border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>📞</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: c.iconBg, border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>✉️</button>
          </div>
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
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Suppliers</div>
          </div>
          <button className="btn" onClick={() => setShowAdd(true)} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Total Suppliers</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{suppliers.length}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." style={{ width: '100%', padding: '11px 12px 11px 36px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>
      <div className="scroll-area" style={{ paddingTop: '12px', paddingRight: '12px', paddingLeft: '12px', paddingBottom: 80 }}>
        {dataError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        {filtered.map(s => (
          <button key={s.id} className="btn card" onClick={() => setSelected(s)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#123A8F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white', flexShrink: 0 }}>{s.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{s.category ?? 'General supplier'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{s._count.purchaseOrders} orders</div>
              <span className="badge badge-blue">{s._count.products} products</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
