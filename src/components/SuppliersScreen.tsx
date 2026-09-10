import { useState } from 'react'

const suppliers = [
  { id: 1, name: 'Unga Limited', category: 'Flour & Grains', contact: 'James Mwenda', phone: '+254 20 330 0000', email: 'orders@unga.com', orders: 12, outstanding: 48000, initials: 'UL', color: '#123A8F', rating: 5, terms: 'Net 30' },
  { id: 2, name: 'Bidco Africa', category: 'Oils & Fats', contact: 'Sarah Kamau', phone: '+254 51 350 5000', email: 'supply@bidco.co.ke', orders: 8, outstanding: 0, initials: 'BA', color: '#2E7D32', rating: 4, terms: 'Net 14' },
  { id: 3, name: 'Procter & Gamble', category: 'FMCG', contact: 'Peter Otieno', phone: '+254 20 421 0000', email: 'kenya@pg.com', orders: 15, outstanding: 32500, initials: 'PG', color: '#0288D1', rating: 5, terms: 'Net 21' },
  { id: 4, name: 'Dawa Limited', category: 'Pharmaceuticals', contact: 'Dr. Mary Njeri', phone: '+254 20 802 8000', email: 'orders@dawa.co.ke', orders: 6, outstanding: 0, initials: 'DL', color: '#D32F2F', rating: 4, terms: 'Prepaid' },
  { id: 5, name: 'Brookside Dairy', category: 'Dairy Products', contact: 'Alice Wambui', phone: '+254 722 111 000', email: 'trade@brookside.co.ke', orders: 22, outstanding: 12000, initials: 'BD', color: '#00796B', rating: 5, terms: 'COD' },
  { id: 6, name: 'Kapa Oil', category: 'Cooking Oil', contact: 'David Kariuki', phone: '+254 20 534 5600', email: 'sales@kapaoil.co.ke', orders: 5, outstanding: 0, initials: 'KO', color: '#F57C00', rating: 3, terms: 'Net 7' },
]

interface Props { onNavigate: (s: string) => void }

export default function SuppliersScreen({ onNavigate }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<typeof suppliers[0] | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', contact: '', phone: '', email: '', terms: 'Net 30' })

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()))
  const totalOutstanding = suppliers.reduce((a, s) => a + s.outstanding, 0)

  if (showAdd) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Supplier</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            {[
              { label: 'Business Name *', key: 'name', placeholder: 'e.g. Unga Limited' },
              { label: 'Category *', key: 'category', placeholder: 'e.g. Flour & Grains' },
              { label: 'Contact Person', key: 'contact', placeholder: 'Full name' },
              { label: 'Phone Number', key: 'phone', placeholder: '+254 ...' },
              { label: 'Email Address', key: 'email', placeholder: 'supplier@email.com' },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Payment Terms</label>
              <select className="input" value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} style={{ appearance: 'none' }}>
                {['COD', 'Prepaid', 'Net 7', 'Net 14', 'Net 21', 'Net 30', 'Net 60'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="btn" onClick={() => setShowAdd(false)} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            Save Supplier
          </button>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
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
            <div style={{ width: 60, height: 60, borderRadius: 18, background: selected.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>{selected.initials}</div>
            <div>
              <div style={{ color: 'white', fontSize: 17, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{selected.category}</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: 10, color: i <= selected.rating ? '#D4AF37' : 'rgba(255,255,255,0.2)' }}>★</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Total Orders', selected.orders, '#123A8F'], ['Outstanding', selected.outstanding > 0 ? `KSh ${selected.outstanding.toLocaleString()}` : 'Cleared', selected.outstanding > 0 ? '#D32F2F' : '#2E7D32']].map(([l, v, c], i) => (
              <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: String(c) }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 12 }}>Contact Information</div>
            {[['Contact Person', selected.contact], ['Phone', selected.phone], ['Email', selected.email], ['Payment Terms', selected.terms]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('purchases')} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>New Order</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: '#E8F5E9', border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>📞</button>
            <button className="btn" style={{ width: 48, padding: '13px', background: '#E3EAF8', border: 'none', borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>✉️</button>
          </div>
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
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Outstanding</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B6B' }}>KSh {(totalOutstanding / 1000).toFixed(0)}K</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." style={{ width: '100%', padding: '11px 12px 11px 36px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {filtered.map(s => (
          <button key={s.id} className="btn card" onClick={() => setSelected(s)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white', flexShrink: 0 }}>{s.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{s.category} · {s.terms}</div>
              <div style={{ display: 'flex', gap: 1, marginTop: 3 }}>{[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: 9, color: i <= s.rating ? '#D4AF37' : '#E8ECF4' }}>★</span>)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>{s.orders} orders</div>
              {s.outstanding > 0 ? <span className="badge badge-error">KSh {(s.outstanding / 1000).toFixed(0)}K</span> : <span className="badge badge-success">Settled</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
