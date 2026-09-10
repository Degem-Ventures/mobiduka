import { useState } from 'react'

const orders = [
  { id: 'PO-2026-084', supplier: 'Unga Limited', date: '8 Jul 2026', items: 6, total: 48000, status: 'pending', dueDate: '10 Jul 2026' },
  { id: 'PO-2026-083', supplier: 'Bidco Africa', date: '7 Jul 2026', items: 4, total: 32500, status: 'delivered', dueDate: '9 Jul 2026' },
  { id: 'PO-2026-082', supplier: 'Procter & Gamble', date: '5 Jul 2026', items: 8, total: 67200, status: 'partial', dueDate: '7 Jul 2026' },
  { id: 'PO-2026-081', supplier: 'Dawa Limited', date: '3 Jul 2026', items: 12, total: 24800, status: 'delivered', dueDate: '5 Jul 2026' },
  { id: 'PO-2026-080', supplier: 'Brookside Dairy', date: '1 Jul 2026', items: 3, total: 18600, status: 'cancelled', dueDate: '3 Jul 2026' },
]

const orderItems = [
  { name: 'Unga Jogoo 2kg', qty: 50, unit: 'Bags', cost: 160, total: 8000 },
  { name: 'Unga Pembe 2kg', qty: 40, unit: 'Bags', cost: 155, total: 6200 },
  { name: 'Sembe 2kg', qty: 60, unit: 'Bags', cost: 110, total: 6600 },
  { name: 'Unga Dola 1kg', qty: 80, unit: 'Bags', cost: 80, total: 6400 },
  { name: 'Maize Meal 2kg', qty: 50, unit: 'Bags', cost: 100, total: 5000 },
  { name: 'Rice Pishori 1kg', qty: 40, unit: 'Packs', cost: 190, total: 7600 },
]

const statusColor: Record<string, string> = {
  pending: '#F9A825',
  delivered: '#2E7D32',
  partial: '#0288D1',
  cancelled: '#D32F2F',
}
const statusBg: Record<string, string> = {
  pending: 'badge-warning',
  delivered: 'badge-success',
  partial: 'badge-blue',
  cancelled: 'badge-error',
}

interface Props { onNavigate: (s: string) => void }

export default function PurchaseOrdersScreen({ onNavigate }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all')
  const [selected, setSelected] = useState<typeof orders[0] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ supplier: '', notes: '' })

  const filtered = orders.filter(o => filter === 'all' || o.status === filter || (filter === 'pending' && o.status === 'partial'))

  if (showNew) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowNew(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>New Purchase Order</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 16 }}>Order Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Supplier *</label>
              <select className="input" style={{ appearance: 'none' }} value={newForm.supplier} onChange={e => setNewForm(f => ({ ...f, supplier: e.target.value }))}>
                <option value="">Select supplier...</option>
                {['Unga Limited', 'Bidco Africa', 'Procter & Gamble', 'Dawa Limited', 'Brookside Dairy'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Expected Delivery Date *</label>
              <input className="input" type="date" defaultValue="2026-07-12" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Notes</label>
              <textarea className="input" rows={3} placeholder="Optional notes..." value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 10 }}>Order Items</div>
          {orderItems.slice(0, 4).map((item, i) => (
            <div key={i} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>KSh {item.cost} / {item.unit}</div>
              </div>
              <input type="number" defaultValue={item.qty}
                style={{ width: 60, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #E8ECF4', textAlign: 'center', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#123A8F' }}>KSh {item.total.toLocaleString()}</div>
            </div>
          ))}

          <button className="btn" style={{ width: '100%', padding: '12px', background: 'rgba(18,58,143,0.08)', border: '1.5px dashed #123A8F', borderRadius: 12, color: '#123A8F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 }}>
            + Add Item
          </button>

          <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
            {[['Subtotal', 'KSh 34,200'], ['Tax (16% VAT)', 'KSh 5,472'], ['Total', 'KSh 39,672']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: i === 2 ? 14 : 13, fontWeight: i === 2 ? 800 : 400, color: i === 2 ? '#0D1B3D' : '#6B7A99' }}>{k}</div>
                <div style={{ fontSize: i === 2 ? 14 : 13, fontWeight: i === 2 ? 800 : 600, color: i === 2 ? '#123A8F' : '#0D1B3D' }}>{v}</div>
              </div>
            ))}
          </div>

          <button className="btn" onClick={() => setShowNew(false)} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            Submit Purchase Order
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
            <div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>{selected.id}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{selected.supplier}</div>
            </div>
            <span className={`badge ${statusBg[selected.status]}`} style={{ marginLeft: 'auto', fontSize: 12 }}>{selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['Order Date', selected.date], ['Due Date', selected.dueDate], ['Items', String(selected.items)]].map(([k, v], i) => (
              <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{k}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 10 }}>Order Items</div>
          {orderItems.map((item, i) => (
            <div key={i} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#6B7A99' }}>{item.qty} {item.unit} × KSh {item.cost}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#123A8F' }}>KSh {item.total.toLocaleString()}</div>
            </div>
          ))}
          <div className="card" style={{ padding: '14px 16px', marginTop: 4, marginBottom: 16 }}>
            {[['Subtotal', `KSh ${selected.total.toLocaleString()}`], ['Received', selected.status === 'delivered' ? `KSh ${selected.total.toLocaleString()}` : 'KSh 0'], ['Balance', selected.status === 'delivered' ? 'KSh 0' : `KSh ${selected.total.toLocaleString()}`]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: i > 0 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: 13, color: '#6B7A99' }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>{v}</div>
              </div>
            ))}
          </div>
          {selected.status === 'pending' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, padding: '13px', background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F', borderRadius: 14, fontSize: 13, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>Edit Order</button>
              <button className="btn" onClick={() => setSelected(null)} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Mark Received</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Purchase Orders</div>
          </div>
          <button className="btn" onClick={() => setShowNew(true)} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>New PO</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'pending', 'delivered'].map(f => (
            <button key={f} className="btn" onClick={() => setFilter(f as 'all' | 'pending' | 'delivered')} style={{ padding: '6px 14px', borderRadius: 100, border: 'none', background: filter === f ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: filter === f ? '#0D1B3D' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['KSh 191K', 'This Month', '#123A8F'], ['3', 'Pending', '#F9A825'], ['2', 'Delivered', '#2E7D32']].map(([v, l, c], i) => (
            <div key={i} className="card" style={{ flex: 1, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: '#6B7A99', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {filtered.map(o => (
          <button key={o.id} className="btn card" onClick={() => setSelected(o)} style={{ width: '100%', padding: '14px 16px', marginBottom: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0D1B3D' }}>{o.id}</div>
                <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>{o.supplier}</div>
              </div>
              <span className={`badge ${statusBg[o.status]}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7A99' }}>{o.items} items · Due {o.dueDate}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#123A8F' }}>KSh {o.total.toLocaleString()}</div>
            </div>
            <div style={{ marginTop: 10, height: 4, background: '#F0F3F9', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: o.status === 'delivered' ? '100%' : o.status === 'partial' ? '60%' : '10%', height: '100%', background: statusColor[o.status], borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
