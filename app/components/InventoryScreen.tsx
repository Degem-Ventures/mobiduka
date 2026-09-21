import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type ProductItem = { id: string; name: string; categoryId: string | null; category: string; cost: number; price: number; stock: number; reorder: number; emoji: string; status: 'good' | 'low' | 'critical'; barcode: string | null }
type CategoryItem = { id: string; name: string; emoji: string | null }

const emojis = ['🌾', '🫙', '🍬', '🧈', '🥛', '🌶️', '💊', '🧺', '🪥', '🍞', '🥚', '☕', '📦', '🥤', '🍫', '🧃']

interface Props {
  onNavigate: (s: string, options?: { barcode?: string }) => void
  initialBarcode?: string
  initialProductId?: string
}

export default function InventoryScreen({ onNavigate, initialBarcode, initialProductId }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'critical'>('all')
  const [selected, setSelected] = useState<ProductItem | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [newCat, setNewCat] = useState({ name: '', emoji: '📦' })
  const [productForm, setProductForm] = useState({ name: '', categoryId: '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' })
  const c = useColors()
  const session = getClientSession()

  const getStatus = (stock: number, reorder: number): ProductItem['status'] => {
    if (stock === 0 || (reorder > 0 && stock <= reorder * 0.3)) return 'critical'
    if (reorder > 0 && stock <= reorder) return 'low'
    return 'good'
  }

  useEffect(() => {
    if (!session) {
      setDataError('Please sign in to load inventory.')
      return
    }
    Promise.all([
      apiFetch<Array<{ id: string; name: string; emoji: string | null; barcode: string | null; costPrice: number | null; sellingPrice: number | null; minimumStock: number | null; category: { id: string; name: string; emoji: string | null } | null; inventory: { quantity: number } | null }>>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<CategoryItem[]>(`/api/categories?businessId=${encodeURIComponent(session.user.businessId)}`),
    ]).then(([productRows, categoryRows]) => {
      setCategories(categoryRows)
      setProducts(productRows.map(product => {
        const stock = Number(product.inventory?.quantity ?? 0)
        const reorder = Number(product.minimumStock ?? 0)
        return {
          id: product.id,
          name: product.name,
          categoryId: product.category?.id ?? null,
          category: product.category?.name ?? 'Uncategorized',
          cost: Number(product.costPrice ?? 0),
          price: Number(product.sellingPrice ?? 0),
          stock,
          reorder,
          emoji: product.emoji ?? product.category?.emoji ?? '📦',
          status: getStatus(stock, reorder),
          barcode: product.barcode,
        }
      }))
    }).catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load inventory.'))
  }, [session?.user.businessId])

  useEffect(() => {
    if (!initialBarcode) return
    setProductForm({ name: '', categoryId: categories[0]?.id ?? '', cost: '', price: '', stock: '', reorder: '', barcode: initialBarcode, emoji: '📦' })
    setEditProduct(null)
    setShowAddProduct(true)
  }, [initialBarcode, categories])

  useEffect(() => {
    if (!initialProductId || showAddProduct || selected) return
    const product = products.find(item => item.id === initialProductId)
    if (product) setSelected(product)
  }, [initialProductId, products, selected, showAddProduct])

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter || (filter === 'low' && (p.status === 'low' || p.status === 'critical'))
    return matchSearch && matchFilter
  })

  if (selected) {
    const margin = Math.round((selected.price - selected.cost) / selected.price * 100)
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <button className="btn" onClick={() => { setSelected(null); onNavigate('inventory') }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Product Details</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{selected.emoji}</div>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>{selected.category}</div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Cost Price', value: `KSh ${selected.cost}`, color: '#D32F2F' },
              { label: 'Selling Price', value: `KSh ${selected.price}`, color: '#123A8F' },
              { label: 'Profit Margin', value: `${margin}%`, color: '#2E7D32' },
              { label: 'Current Stock', value: `${selected.stock} units`, color: selected.status === 'critical' ? '#D32F2F' : selected.status === 'low' ? '#F9A825' : '#2E7D32' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 12 }}>Stock Information</div>
            {[
              ['Reorder Level', `${selected.reorder} units`],
              ['Stock Status', selected.status === 'critical' ? '🔴 Critical' : selected.status === 'low' ? '🟡 Low Stock' : '🟢 In Stock'],
              ['Units Below Reorder', selected.stock < selected.reorder ? `${selected.reorder - selected.stock} units` : 'None'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? c.divider : 'none' }}>
                <div style={{ fontSize: 13, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => {
              setProductForm({ name: selected.name, categoryId: selected.categoryId ?? '', cost: String(selected.cost), price: String(selected.price), stock: String(selected.stock), reorder: String(selected.reorder), barcode: selected.barcode ?? '', emoji: selected.emoji })
              setEditProduct(selected)
              setSelected(null)
              setShowAddProduct(true)
            }} style={{ flex: 1, padding: '14px', background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>Edit Product</button>
            <button className="btn" onClick={() => onNavigate('purchases')} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Purchase Order</button>
          </div>
        </div>
      </div>
    )
  }

  const criticalCount = products.filter(p => p.status === 'critical').length
  const lowCount = products.filter(p => p.status === 'low').length

  const saveProduct = async () => {
    if (!session || !productForm.name.trim() || !productForm.categoryId) return
    const p = productForm
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/products', {
        method: editProduct ? 'PATCH' : 'POST',
        body: JSON.stringify({
          businessId: session.user.businessId,
          ...(editProduct ? { id: editProduct.id } : {}),
          name: p.name.trim(),
          categoryId: p.categoryId,
          costPrice: Number(p.cost),
          sellingPrice: Number(p.price),
          stock: Number(p.stock),
          minimumStock: Number(p.reorder),
          barcode: p.barcode.trim() || null,
          emoji: p.emoji,
        }),
      })
      const refreshed = await apiFetch<Array<{ id: string; name: string; emoji: string | null; barcode: string | null; costPrice: number | null; sellingPrice: number | null; minimumStock: number | null; category: { id: string; name: string; emoji: string | null } | null; inventory: { quantity: number } | null }>>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`)
      setProducts(refreshed.map(product => {
        const stock = Number(product.inventory?.quantity ?? 0)
        const reorder = Number(product.minimumStock ?? 0)
        return { id: product.id, name: product.name, categoryId: product.category?.id ?? null, category: product.category?.name ?? 'Uncategorized', cost: Number(product.costPrice ?? 0), price: Number(product.sellingPrice ?? 0), stock, reorder, emoji: product.emoji ?? product.category?.emoji ?? '📦', status: getStatus(stock, reorder), barcode: product.barcode }
      }))
      setShowAddProduct(false)
      setEditProduct(null)
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to save product.')
    } finally {
      setSaving(false)
    }
  }

  // Add Category modal
  if (showAddCategory) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowAddCategory(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Add Category</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Category Name *</label>
              <input className="input" placeholder="e.g. Beverages" value={newCat.name} onChange={e => setNewCat(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Icon / Emoji</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {emojis.map(e => (
                  <button key={e} className="btn" onClick={() => setNewCat(prev => ({ ...prev, emoji: e }))} style={{ width: 42, height: 42, borderRadius: 10, border: newCat.emoji === e ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: newCat.emoji === e ? 'rgba(18,58,143,0.08)' : c.card, fontSize: 22, cursor: 'pointer' }}>{e}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Existing Categories</div>
            {categories.map((cat, i) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < categories.length - 1 ? c.divider : 'none' }}>
                <div style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{cat.emoji ?? '📦'} {cat.name}</div>
                <div style={{ fontSize: 11, color: c.faint }}>{products.filter(p => p.categoryId === cat.id).length} items</div>
              </div>
            ))}
          </div>
          <button className="btn" disabled={saving} onClick={async () => {
            if (!session || !newCat.name.trim()) return
            setSaving(true)
            try {
              const category = await apiFetch<CategoryItem>('/api/categories', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, name: newCat.name.trim(), emoji: newCat.emoji }) })
              setCategories(prev => [...prev, category])
              setNewCat({ name: '', emoji: '📦' })
              setShowAddCategory(false)
            } catch (reason) {
              setDataError(reason instanceof Error ? reason.message : 'Unable to save category.')
            } finally {
              setSaving(false)
            }
          }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Save Category
          </button>
        </div>
      </div>
    )
  }

  // Add/Edit Product screen
  if (showAddProduct) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => { setShowAddProduct(false); setEditProduct(null) }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{editProduct ? 'Edit Product' : 'Add Product'}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          {/* Emoji picker */}
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10 }}>Product Icon</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {emojis.map(e => (
                <button key={e} className="btn" onClick={() => setProductForm(f => ({ ...f, emoji: e }))} style={{ width: 40, height: 40, borderRadius: 10, border: productForm.emoji === e ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: productForm.emoji === e ? 'rgba(18,58,143,0.1)' : c.card, fontSize: 20, cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Product Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Product Name *</label>
              <input className="input" placeholder="e.g. Unga Jogoo 2kg" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Barcode</label>
              <input className="input" inputMode="numeric" placeholder="Scan or enter barcode" value={productForm.barcode} onChange={e => setProductForm(f => ({ ...f, barcode: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Category *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input" style={{ flex: 1, appearance: 'none' }} value={productForm.categoryId} onChange={e => setProductForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.emoji ?? '📦'} {cat.name}</option>)}
                </select>
                <button className="btn" onClick={() => setShowAddCategory(true)} style={{ padding: '11px 12px', background: c.iconBg, border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Cat</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Pricing & Stock</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Cost Price (KSh) *', key: 'cost', placeholder: '0' },
                { label: 'Selling Price (KSh) *', key: 'price', placeholder: '0' },
                { label: 'Current Stock *', key: 'stock', placeholder: '0' },
                { label: 'Reorder Level', key: 'reorder', placeholder: '10' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input className="input" type="number" placeholder={f.placeholder}
                    value={productForm[f.key as keyof typeof productForm] as string}
                    onChange={e => setProductForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ padding: '10px 12px', fontSize: 15, fontWeight: 700 }} />
                </div>
              ))}
            </div>
            {productForm.cost && productForm.price && Number(productForm.price) > Number(productForm.cost) && (
              <div style={{ background: c.successBg, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>Profit Margin</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>{Math.round((Number(productForm.price) - Number(productForm.cost)) / Number(productForm.price) * 100)}%</div>
              </div>
            )}
          </div>

          <button className="btn" onClick={() => void saveProduct()} disabled={saving || !productForm.name.trim() || !productForm.categoryId} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {saving ? 'Saving...' : editProduct ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      {dataError && <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Inventory</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowAddCategory(true)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>+ Category</button>
              <button className="btn" onClick={() => { setProductForm({ name: '', categoryId: categories[0]?.id ?? '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' }); setEditProduct(null); setShowAddProduct(true) }} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16, color: '#0D1B3D', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Product</span>
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Total SKUs', value: String(products.length), color: 'rgba(255,255,255,0.9)' },
            { label: 'Critical', value: String(criticalCount), color: '#FF6B6B' },
            { label: 'Low Stock', value: String(lowCount), color: '#FFD93D' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
            style={{ width: '100%', padding: '11px 12px 11px 36px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ background: c.card, borderBottom: c.divider, display: 'flex', flexShrink: 0 }}>
        {[['all', 'All Products'], ['low', 'Low Stock'], ['critical', 'Critical']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setFilter(key as 'all' | 'low' | 'critical')} style={{
            flex: 1, padding: '12px 8px', border: 'none',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: filter === key ? '2px solid #123A8F' : '2px solid transparent',
            color: filter === key ? '#123A8F' : c.muted,
            fontSize: 12, fontWeight: 600
          }}>{label}</button>
        ))}
      </div>

      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {filtered.map(p => (
          <button key={p.id} className="btn card" onClick={() => setSelected(p)} style={{
            width: '100%', marginBottom: 8, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{p.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: c.muted }}>{p.category} · Cost: KSh {p.cost}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#123A8F', marginBottom: 3 }}>KSh {p.price}</div>
              <span className={`badge ${p.status === 'critical' ? 'badge-error' : p.status === 'low' ? 'badge-warning' : 'badge-success'}`}>
                {p.stock} units
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position: 'absolute', bottom: 80, right: 16 }}>
        <button className="btn" onClick={() => { setProductForm({ name: '', categoryId: categories[0]?.id ?? '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' }); setEditProduct(null); setShowAddProduct(true) }} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
          border: 'none', fontSize: 24, color: '#0D1B3D',
          boxShadow: '0 4px 16px rgba(212,175,55,0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>+</button>
      </div>
    </div>
  )
}
