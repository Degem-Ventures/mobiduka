import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Supplier = { id: string; name: string; category: string | null; contactPerson: string | null; phone: string | null; email: string | null; location: string | null; notes: string | null; paymentTerms: string; rating: number; outstandingBalance: number; _count: { purchaseOrders: number; products: number } }
type SupplierForm = { name: string; category: string; contact: string; phone: string; email: string; location: string; notes: string; paymentTerms: string; rating: string; outstandingBalance: string }

const emptySupplierForm: SupplierForm = { name: '', category: '', contact: '', phone: '', email: '', location: '', notes: '', paymentTerms: 'Net 30', rating: '5', outstandingBalance: '0' }
const supplierColors = ['#123A8F', '#2E7D32', '#0288D1', '#D32F2F', '#00796B', '#F57C00']

interface Props { onNavigate: (s: string) => void }

export default function SuppliersScreen({ onNavigate }: Props) {
  const c = useColors()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<SupplierForm>(emptySupplierForm)
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)
  const session = getClientSession()

  useEffect(() => {
    if (!session) { setDataError('Please sign in to load suppliers.'); return }
    apiFetch<Supplier[]>(`/api/suppliers?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(setSuppliers)
      .catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load suppliers.'))
  }, [session?.user.businessId])

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.category ?? '').toLowerCase().includes(search.toLowerCase()))
  const totalOutstanding = suppliers.reduce((total, supplier) => total + supplier.outstandingBalance, 0)
  const supplierInitials = (supplier: Supplier) => supplier.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()
  const formatCompactAmount = (amount: number) => amount >= 1000 ? `KSh ${(amount / 1000).toFixed(0)}K` : `KSh ${amount.toLocaleString()}`
  const openAdd = () => { setForm(emptySupplierForm); setEditingSupplier(null); setShowAdd(true) }

  const startEdit = (supplier: Supplier) => {
    setForm({ name: supplier.name, category: supplier.category ?? '', contact: supplier.contactPerson ?? '', phone: supplier.phone ?? '', email: supplier.email ?? '', location: supplier.location ?? '', notes: supplier.notes ?? '', paymentTerms: supplier.paymentTerms ?? 'Net 30', rating: String(supplier.rating ?? 5), outstandingBalance: String(supplier.outstandingBalance ?? 0) })
    setEditingSupplier(supplier)
    setSelected(null)
    setShowAdd(true)
  }

  const deleteSupplier = async () => {
    const target = supplierToDelete ?? selected
    if (!session || !target) return
    setSaving(true); setDataError('')
    try {
      await apiFetch(`/api/suppliers?id=${encodeURIComponent(target.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setSuppliers(previous => previous.filter(supplier => supplier.id !== target.id))
      setSelected(null)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to delete supplier.') }
    finally { setSaving(false); setConfirmDelete(false); setSupplierToDelete(null) }
  }

  if (showAdd) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</div>
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
              { label: 'Location', key: 'location', placeholder: 'Town or branch' },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Payment Terms</label>
              <select className="input" value={form.paymentTerms} onChange={event => setForm(previous => ({ ...previous, paymentTerms: event.target.value }))}>
                {['COD', 'Prepaid', 'Net 7', 'Net 14', 'Net 21', 'Net 30', 'Net 60'].map(term => <option key={term} value={term}>{term}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Rating</label><select className="input" value={form.rating} onChange={event => setForm(previous => ({ ...previous, rating: event.target.value }))}>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} stars</option>)}</select></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Outstanding (KSh)</label><input className="input" type="number" min="0" value={form.outstandingBalance} onChange={event => setForm(previous => ({ ...previous, outstandingBalance: event.target.value }))} /></div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Notes</label>
              <textarea className="input" rows={3} placeholder="Optional supplier notes" value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} style={{ resize: 'vertical' }} />
            </div>
          </div>
          <button className="btn" disabled={saving} onClick={async () => {
            if (!session || !form.name.trim()) return
            setSaving(true)
            try {
              const supplier = await apiFetch<Supplier>('/api/suppliers', { method: editingSupplier ? 'PATCH' : 'POST', body: JSON.stringify({ businessId: session.user.businessId, ...(editingSupplier ? { id: editingSupplier.id } : {}), name: form.name, category: form.category, contactPerson: form.contact, phone: form.phone, email: form.email, location: form.location, notes: form.notes, paymentTerms: form.paymentTerms, rating: Number(form.rating), outstandingBalance: Number(form.outstandingBalance) }) })
              setSuppliers(previous => editingSupplier ? previous.map(item => item.id === supplier.id ? supplier : item) : [...previous, supplier])
              setForm(emptySupplierForm)
              setShowAdd(false); setEditingSupplier(null)
            } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to save supplier.') }
            finally { setSaving(false) }
          }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Save Supplier'}
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
            <button className="btn" onClick={() => startEdit(selected)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Edit supplier">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: supplierColors[suppliers.findIndex(supplier => supplier.id === selected.id) % supplierColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>{supplierInitials(selected)}</div>
            <div>
              <div style={{ color: 'white', fontSize: 17, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{selected.category ?? 'General supplier'}</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>{[1, 2, 3, 4, 5].map(star => <span key={star} style={{ color: star <= selected.rating ? '#D4AF37' : 'rgba(255,255,255,0.25)', fontSize: 11 }}>★</span>)}</div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: '16px', paddingRight: '16px', paddingLeft: '16px', paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Total Orders', selected._count.purchaseOrders, '#123A8F'], ['Outstanding', selected.outstandingBalance > 0 ? `KSh ${selected.outstandingBalance.toLocaleString()}` : 'Settled', selected.outstandingBalance > 0 ? '#D32F2F' : '#2E7D32']].map(([l, v, col], i) => (
              <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: String(col) }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 12 }}>Contact Information</div>
            {[['Contact Person', selected.contactPerson ?? 'Not provided'], ['Phone', selected.phone ?? 'Not provided'], ['Email', selected.email ?? 'Not provided'], ['Payment Terms', selected.paymentTerms]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? c.divider : 'none' }}>
                <div style={{ fontSize: 12, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('purchases')} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>New Order</button>
            <button className="btn" onClick={() => setConfirmDelete(true)} style={{ padding: '13px', background: c.errorBg, border: '1px solid #D32F2F', borderRadius: 14, fontSize: 13, fontWeight: 700, color: '#D32F2F', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: '#E8F5E9', border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>📞</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: c.iconBg, border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>✉️</button>
          </div>
          {confirmDelete && <div role="alert" className="card" style={{ padding: 14, marginTop: 14, border: '1px solid #EF9A9A' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#B71C1C', marginBottom: 10 }}>Delete {selected.name}?</div><div style={{ fontSize: 12, color: c.muted, marginBottom: 12 }}>This cannot be undone. Suppliers linked to products or orders are protected.</div><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 8, background: c.iconBg, cursor: 'pointer' }}>Cancel</button><button className="btn" disabled={saving} onClick={() => void deleteSupplier()} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 8, background: '#D32F2F', color: 'white', cursor: 'pointer' }}>Delete</button></div></div>}
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
          <button className="btn" onClick={openAdd} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Total Suppliers</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{suppliers.length}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Outstanding</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF8A80' }}>{formatCompactAmount(totalOutstanding)}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." style={{ width: '100%', padding: '11px 12px 11px 36px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>
      <div className="scroll-area" style={{ paddingTop: '12px', paddingRight: '12px', paddingLeft: '12px', paddingBottom: 80 }}>
        {dataError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        {supplierToDelete && <div className="card" style={{ padding: 14, marginBottom: 12, border: '1px solid #EF9A9A', background: c.errorBg }}><div style={{ fontSize: 13, fontWeight: 700, color: '#B71C1C', marginBottom: 10 }}>Delete {supplierToDelete.name}?</div><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => setSupplierToDelete(null)} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 8, background: c.card, cursor: 'pointer' }}>Cancel</button><button className="btn" disabled={saving} onClick={() => void deleteSupplier()} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 8, background: '#D32F2F', color: 'white', cursor: 'pointer' }}>Delete</button></div></div>}
        {filtered.map(s => (
          <div key={s.id} className="card" style={{ width: '100%', marginBottom: 10, padding: '14px 12px 14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={() => setSelected(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: supplierColors[suppliers.findIndex(supplier => supplier.id === s.id) % supplierColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white', flexShrink: 0 }}>{supplierInitials(s)}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.name}</div><div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{s.category ?? 'General supplier'} · {s.paymentTerms}</div><div style={{ display: 'flex', gap: 1, marginTop: 3 }}>{[1, 2, 3, 4, 5].map(star => <span key={star} style={{ fontSize: 9, color: star <= s.rating ? '#D4AF37' : c.faint }}>★</span>)}</div></div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{s._count.purchaseOrders} orders</div>{s.outstandingBalance > 0 ? <span className="badge badge-error">{formatCompactAmount(s.outstandingBalance)}</span> : <span className="badge badge-success">Settled</span>}</div>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button className="btn" onClick={() => setSupplierToDelete(s)} aria-label={`Delete ${s.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
