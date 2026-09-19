import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type OrderItem = { name: string; qty: number; unit: string; cost: number; total: number; productId: string }
type PurchaseOrder = { id: string; orderNo: string; supplierId: string | null; supplier: string; date: string; items: number; total: number; status: 'pending' | 'delivered' | 'partial' | 'cancelled'; dueDate: string; itemRows: OrderItem[] }
type Supplier = { id: string; name: string }
type Product = { id: string; name: string; unit: string | null; costPrice: number | null }
type NewOrderItem = { productId: string; quantity: string; costPrice: string }

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
  const c = useColors()
  const session = getClientSession()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all')
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ supplierId: '', dueDate: '', notes: '' })
  const [newItems, setNewItems] = useState<NewOrderItem[]>([])

  const loadData = () => {
    if (!session) { setDataError('Please sign in to load purchase orders.'); return }
    Promise.all([
      apiFetch<Array<{ id: string; orderNo: string | null; supplierId: string | null; supplier: { name: string } | null; status: string; totalCost: number; dueDate: string | null; createdAt: string; items: Array<{ productId: string; quantity: number; costPrice: number; product: { name: string; unit: string | null } }> }>>(`/api/purchase-orders?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<Supplier[]>(`/api/suppliers?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<Product[]>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`),
    ]).then(([orderRows, supplierRows, productRows]) => {
      setSuppliers(supplierRows)
      setProducts(productRows)
      setOrders(orderRows.map(order => ({
        id: order.id,
        orderNo: order.orderNo ?? order.id,
        supplierId: order.supplierId,
        supplier: order.supplier?.name ?? 'Unassigned supplier',
        date: new Date(order.createdAt).toLocaleDateString(),
        items: order.items.length,
        total: Number(order.totalCost),
        status: order.status.toLowerCase() === 'received' ? 'delivered' : order.status.toLowerCase() === 'partial' ? 'partial' : order.status.toLowerCase() === 'cancelled' ? 'cancelled' : 'pending',
        dueDate: order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'Not specified',
        itemRows: order.items.map(item => ({ name: item.product.name, qty: item.quantity, unit: item.product.unit ?? 'units', cost: item.costPrice, total: item.quantity * item.costPrice, productId: item.productId })),
      })))
    }).catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load purchase orders.'))
  }

  useEffect(loadData, [session?.user.businessId])

  const filtered = orders.filter(o => filter === 'all' || (filter === 'pending' && (o.status === 'pending' || o.status === 'partial')) || (filter === 'delivered' && o.status === 'delivered'))

  const submitOrder = async () => {
    if (!session || !newForm.supplierId || newItems.length === 0 || newItems.some(item => !item.productId || Number(item.quantity) < 1 || Number(item.costPrice) < 0)) return
    setSaving(true)
    setDataError('')
    try {
      const items = newItems.map(item => ({ productId: item.productId, quantity: Number(item.quantity), costPrice: Number(item.costPrice) }))
      await apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          action: 'CREATE',
          businessId: session.user.businessId,
          supplierId: newForm.supplierId,
          orderNo: `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
          dueDate: newForm.dueDate || null,
          totalCost: items.reduce((total, item) => total + item.quantity * item.costPrice, 0),
          items,
        }),
      })
      setNewForm({ supplierId: '', dueDate: '', notes: '' })
      setNewItems([])
      setShowNew(false)
      loadData()
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to create purchase order.') }
    finally { setSaving(false) }
  }

  const addOrderItem = () => {
    const product = products.find(candidate => !newItems.some(item => item.productId === candidate.id)) ?? products[0]
    if (!product) return
    setNewItems(previous => [...previous, { productId: product.id, quantity: '1', costPrice: String(product.costPrice ?? 0) }])
  }

  const updateOrderItem = (index: number, changes: Partial<NewOrderItem>) => {
    setNewItems(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }

  const removeOrderItem = (index: number) => {
    setNewItems(previous => previous.filter((_, itemIndex) => itemIndex !== index))
  }

  const newOrderTotal = newItems.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.costPrice || 0), 0)

  const receiveOrder = async () => {
    if (!session || !selected) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          action: 'RECEIVE',
          businessId: session.user.businessId,
          orderId: selected.id,
        }),
      })
      setSelected(null)
      loadData()
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to mark purchase order as received.')
    } finally {
      setSaving(false)
    }
  }

  if (showNew) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowNew(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>New Purchase Order</div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: '20px', paddingRight: '16px', paddingLeft: '16px', paddingBottom: 100 }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 16 }}>Order Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Supplier *</label>
              <select className="input" style={{ appearance: 'none' }} value={newForm.supplierId} onChange={e => setNewForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">Select supplier...</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Expected Delivery Date *</label>
              <input className="input" type="date" value={newForm.dueDate} onChange={event => setNewForm(form => ({ ...form, dueDate: event.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Notes</label>
              <textarea className="input" rows={3} placeholder="Optional notes..." value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 10 }}>Order Items</div>
          {newItems.map((item, index) => {
            const product = products.find(candidate => candidate.id === item.productId)
            return (
              <div key={`${item.productId}-${index}`} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <select className="input" value={item.productId} onChange={event => {
                    const nextProduct = products.find(candidate => candidate.id === event.target.value)
                    updateOrderItem(index, { productId: event.target.value, costPrice: String(nextProduct?.costPrice ?? 0) })
                  }} style={{ flex: 1, appearance: 'none', padding: '8px 10px' }}>
                    {products.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                  </select>
                  <button className="btn" type="button" onClick={() => removeOrderItem(index)} aria-label="Remove order item" title="Remove order item" style={{ width: 32, height: 32, border: 'none', background: '#FFEBEE', color: '#C62828', borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: c.muted }}>Quantity
                    <input type="number" min={1} value={item.quantity} onChange={event => updateOrderItem(index, { quantity: event.target.value })} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8ECF4', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  </label>
                  <label style={{ fontSize: 11, color: c.muted }}>Buying price (KSh)
                    <input type="number" min={0} step="0.01" value={item.costPrice} onChange={event => updateOrderItem(index, { costPrice: event.target.value })} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8ECF4', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  </label>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: c.muted }}>
                  {product?.unit ?? 'units'} · Line total: <strong style={{ color: '#123A8F' }}>KSh {(Number(item.quantity || 0) * Number(item.costPrice || 0)).toLocaleString()}</strong>
                </div>
              </div>
            )
          })}

          <button className="btn" type="button" onClick={addOrderItem} disabled={products.length === 0 || newItems.length >= products.length} style={{ width: '100%', padding: '12px', background: 'rgba(18,58,143,0.08)', border: '1.5px dashed #123A8F', borderRadius: 12, color: '#123A8F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 }}>
            + Add Item
          </button>

          <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
            {[['Subtotal', `KSh ${newOrderTotal.toLocaleString()}`], ['Tax (0%)', 'KSh 0'], ['Total', `KSh ${newOrderTotal.toLocaleString()}`]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? c.divider : 'none' }}>
                <div style={{ fontSize: i === 2 ? 14 : 13, fontWeight: i === 2 ? 800 : 400, color: i === 2 ? c.text : c.muted }}>{k}</div>
                <div style={{ fontSize: i === 2 ? 14 : 13, fontWeight: i === 2 ? 800 : 600, color: i === 2 ? '#123A8F' : c.text }}>{v}</div>
              </div>
            ))}
          </div>

          <button className="btn" disabled={saving || !newForm.supplierId || newItems.length === 0} onClick={() => void submitOrder()} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {saving ? 'Submitting...' : 'Submit Purchase Order'}
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
            <div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>{selected.orderNo}</div>
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
        <div className="scroll-area" style={{ paddingTop: '16px', paddingRight: '16px', paddingLeft: '16px', paddingBottom: 80 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 10 }}>Order Items</div>
          {selected.itemRows.map((item, i) => (
            <div key={i} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{item.name}</div>
                <div style={{ fontSize: 11, color: c.muted }}>{item.qty} {item.unit} × KSh {item.cost}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#123A8F' }}>KSh {item.total.toLocaleString()}</div>
            </div>
          ))}
          <div className="card" style={{ padding: '14px 16px', marginTop: 4, marginBottom: 16 }}>
            {[['Subtotal', `KSh ${selected.total.toLocaleString()}`], ['Received', selected.status === 'delivered' ? `KSh ${selected.total.toLocaleString()}` : 'KSh 0'], ['Balance', selected.status === 'delivered' ? 'KSh 0' : `KSh ${selected.total.toLocaleString()}`]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: i > 0 ? c.divider : 'none' }}>
                <div style={{ fontSize: 13, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>
          {(selected.status === 'pending' || selected.status === 'partial') && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, padding: '13px', background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F', borderRadius: 14, fontSize: 13, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>Edit Order</button>
              <button className="btn" disabled={saving} onClick={() => void receiveOrder()} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Updating...' : 'Mark Received'}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
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
      <div className="scroll-area" style={{ paddingTop: '12px', paddingRight: '12px', paddingLeft: '12px', paddingBottom: 80 }}>
        {dataError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[
            [`KSh ${orders.reduce((total, order) => total + order.total, 0).toLocaleString()}`, 'This Month', '#123A8F'],
            [String(orders.filter(order => order.status === 'pending' || order.status === 'partial').length), 'Pending', '#F9A825'],
            [String(orders.filter(order => order.status === 'delivered').length), 'Delivered', '#2E7D32'],
          ].map(([v, l, col], i) => (
            <div key={i} className="card" style={{ flex: 1, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: col }}>{v}</div>
              <div style={{ fontSize: 10, color: c.muted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {filtered.map(o => (
          <button key={o.id} className="btn card" onClick={() => setSelected(o)} style={{ width: '100%', padding: '14px 16px', marginBottom: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>{o.orderNo}</div>
                <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{o.supplier}</div>
              </div>
              <span className={`badge ${statusBg[o.status]}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: c.muted }}>{o.items} items · Due {o.dueDate}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#123A8F' }}>KSh {o.total.toLocaleString()}</div>
            </div>
            <div style={{ marginTop: 10, height: 4, background: c.cardAlt, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: o.status === 'delivered' ? '100%' : o.status === 'partial' ? '60%' : '10%', height: '100%', background: statusColor[o.status], borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
