import { useState } from 'react'

type ProductItem = { id: number; name: string; category: string; cost: number; price: number; stock: number; reorder: number; emoji: string; status: string }

const defaultCategories = ['Flour', 'Oils', 'Sugar', 'Spreads', 'Dairy', 'Spices', 'Pharma', 'Detergent', 'Personal', 'Bakery', 'Beverages']
const emojis = ['🌾', '🫙', '🍬', '🧈', '🥛', '🌶️', '💊', '🧺', '🪥', '🍞', '🥚', '☕', '📦', '🥤', '🍫', '🧃']

const initialProducts: ProductItem[] = [
  { id: 1, name: 'Unga Jogoo 2kg', category: 'Flour', cost: 160, price: 200, stock: 45, reorder: 20, emoji: '🌾', status: 'good' },
  { id: 2, name: 'Cooking Oil 1L', category: 'Oils', cost: 150, price: 190, stock: 32, reorder: 15, emoji: '🫙', status: 'good' },
  { id: 3, name: 'Sugar 1kg', category: 'Sugar', cost: 100, price: 140, stock: 28, reorder: 30, emoji: '🍬', status: 'low' },
  { id: 4, name: 'Blue Band 500g', category: 'Spreads', cost: 110, price: 150, stock: 18, reorder: 20, emoji: '🧈', status: 'low' },
  { id: 5, name: 'Milk 500ml', category: 'Dairy', cost: 75, price: 100, stock: 60, reorder: 40, emoji: '🥛', status: 'good' },
  { id: 6, name: 'Royco 75g', category: 'Spices', cost: 30, price: 45, stock: 5, reorder: 20, emoji: '🌶️', status: 'critical' },
  { id: 7, name: 'Panadol 500mg', category: 'Pharma', cost: 20, price: 30, stock: 3, reorder: 50, emoji: '💊', status: 'critical' },
  { id: 8, name: 'Omo 400g', category: 'Detergent', cost: 130, price: 180, stock: 8, reorder: 15, emoji: '🧺', status: 'low' },
  { id: 9, name: 'Colgate 100ml', category: 'Personal', cost: 60, price: 85, stock: 22, reorder: 20, emoji: '🪥', status: 'good' },
  { id: 10, name: 'Bread White', category: 'Bakery', cost: 40, price: 55, stock: 15, reorder: 20, emoji: '🍞', status: 'low' },
  { id: 11, name: 'Eggs (tray)', category: 'Dairy', cost: 380, price: 480, stock: 12, reorder: 10, emoji: '🥚', status: 'good' },
  { id: 12, name: 'Nescafé 100g', category: 'Beverages', cost: 240, price: 320, stock: 9, reorder: 12, emoji: '☕', status: 'low' },
]

interface Props {
  onNavigate: (s: string) => void
}

export default function InventoryScreen({ onNavigate }: Props) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts)
  const [categories, setCategories] = useState(defaultCategories)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'critical'>('all')
  const [selected, setSelected] = useState<ProductItem | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [newCat, setNewCat] = useState({ name: '', emoji: '📦' })
  const [productForm, setProductForm] = useState({ name: '', category: 'Flour', cost: '', price: '', stock: '', reorder: '', emoji: '📦' })

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter || (filter === 'low' && (p.status === 'low' || p.status === 'critical'))
    return matchSearch && matchFilter
  })

  if (selected) {
    const margin = Math.round((selected.price - selected.cost) / selected.price * 100)
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <button className="btn" onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
                <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 12 }}>Stock Information</div>
            {[
              ['Reorder Level', `${selected.reorder} units`],
              ['Stock Status', selected.status === 'critical' ? '🔴 Critical' : selected.status === 'low' ? '🟡 Low Stock' : '🟢 In Stock'],
              ['Units Below Reorder', selected.stock < selected.reorder ? `${selected.reorder - selected.stock} units` : 'None'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: 13, color: '#6B7A99' }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => {
              setProductForm({ name: selected.name, category: selected.category, cost: String(selected.cost), price: String(selected.price), stock: String(selected.stock), reorder: String(selected.reorder), emoji: selected.emoji })
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

  const saveProduct = () => {
    const p = productForm
    const cost = Number(p.cost), price = Number(p.price), stock = Number(p.stock), reorder = Number(p.reorder)
    const status = stock === 0 ? 'critical' : stock <= reorder * 0.3 ? 'critical' : stock < reorder ? 'low' : 'good'
    if (editProduct) {
      setProducts(list => list.map(x => x.id === editProduct.id ? { ...x, name: p.name, category: p.category, cost, price, stock, reorder, emoji: p.emoji, status } : x))
    } else {
      setProducts(list => [...list, { id: Date.now(), name: p.name, category: p.category, cost, price, stock, reorder, emoji: p.emoji, status }])
    }
    setShowAddProduct(false)
    setEditProduct(null)
  }

  // Add Category modal
  if (showAddCategory) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Category Name *</label>
              <input className="input" placeholder="e.g. Beverages" value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 8 }}>Icon / Emoji</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {emojis.map(e => (
                  <button key={e} className="btn" onClick={() => setNewCat(c => ({ ...c, emoji: e }))} style={{ width: 42, height: 42, borderRadius: 10, border: newCat.emoji === e ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: newCat.emoji === e ? 'rgba(18,58,143,0.08)' : 'white', fontSize: 22, cursor: 'pointer' }}>{e}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Existing Categories</div>
            {categories.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < categories.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: 13, color: '#0D1B3D', fontWeight: 500 }}>{c}</div>
                <div style={{ fontSize: 11, color: '#B0BAD3' }}>{products.filter(p => p.category === c).length} items</div>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => {
            if (newCat.name) { setCategories(c => [...c, newCat.name]); setNewCat({ name: '', emoji: '📦' }) }
            setShowAddCategory(false)
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
      <div className="screen" style={{ background: '#F5F7FA' }}>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', marginBottom: 10 }}>Product Icon</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {emojis.map(e => (
                <button key={e} className="btn" onClick={() => setProductForm(f => ({ ...f, emoji: e }))} style={{ width: 40, height: 40, borderRadius: 10, border: productForm.emoji === e ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: productForm.emoji === e ? 'rgba(18,58,143,0.1)' : 'white', fontSize: 20, cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Product Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Product Name *</label>
              <input className="input" placeholder="e.g. Unga Jogoo 2kg" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Category *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input" style={{ flex: 1, appearance: 'none' }} value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <button className="btn" onClick={() => setShowAddCategory(true)} style={{ padding: '11px 12px', background: '#E3EAF8', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Cat</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 14 }}>Pricing & Stock</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Cost Price (KSh) *', key: 'cost', placeholder: '0' },
                { label: 'Selling Price (KSh) *', key: 'price', placeholder: '0' },
                { label: 'Current Stock *', key: 'stock', placeholder: '0' },
                { label: 'Reorder Level', key: 'reorder', placeholder: '10' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input className="input" type="number" placeholder={f.placeholder}
                    value={productForm[f.key as keyof typeof productForm] as string}
                    onChange={e => setProductForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ padding: '10px 12px', fontSize: 15, fontWeight: 700 }} />
                </div>
              ))}
            </div>
            {productForm.cost && productForm.price && Number(productForm.price) > Number(productForm.cost) && (
              <div style={{ background: '#E8F5E9', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>Profit Margin</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>{Math.round((Number(productForm.price) - Number(productForm.cost)) / Number(productForm.price) * 100)}%</div>
              </div>
            )}
          </div>

          <button className="btn" onClick={saveProduct} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {editProduct ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Inventory</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowAddCategory(true)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>+ Category</button>
            <button className="btn" onClick={() => { setProductForm({ name: '', category: 'Flour', cost: '', price: '', stock: '', reorder: '', emoji: '📦' }); setEditProduct(null); setShowAddProduct(true) }} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16, color: '#0D1B3D', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Product</span>
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Total SKUs', value: '486', color: 'rgba(255,255,255,0.9)' },
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
      <div style={{ background: 'white', borderBottom: '1px solid #E8ECF4', display: 'flex', flexShrink: 0 }}>
        {[['all', 'All Products'], ['low', 'Low Stock'], ['critical', 'Critical']].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setFilter(key as 'all' | 'low' | 'critical')} style={{
            flex: 1, padding: '12px 8px', border: 'none',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: filter === key ? '2px solid #123A8F' : '2px solid transparent',
            color: filter === key ? '#123A8F' : '#6B7A99',
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
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E3EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{p.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#6B7A99' }}>{p.category} · Cost: KSh {p.cost}</div>
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
        <button className="btn" style={{
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
