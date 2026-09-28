import { useEffect, useRef, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type ProductItem = { id: string; name: string; categoryId: string | null; category: string; cost: number; price: number; stock: number; reorder: number; emoji: string; status: 'good' | 'low' | 'critical'; barcode: string | null; deletedAt?: string | null }
type CategoryItem = { id: string; name: string; emoji: string | null; deletedAt?: string | null }
type Toast = { message: string; tone: 'success' | 'error' }

const emojis = ['🌾', '🫙', '🍬', '🧈', '🥛', '🌶️', '💊', '🧺', '🪥', '🍞', '🥚', '☕', '📦', '🥤', '🍫', '🧃']

interface Props {
  onNavigate: (s: string, options?: { barcode?: string }) => void
  initialBarcode?: string
  initialProductId?: string
}

export default function InventoryScreen({ onNavigate, initialBarcode, initialProductId }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [deletedCategories, setDeletedCategories] = useState<CategoryItem[]>([])
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'critical'>('all')
  const [selected, setSelected] = useState<ProductItem | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [newCat, setNewCat] = useState({ name: '', emoji: '📦' })
  const [productForm, setProductForm] = useState({ name: '', categoryId: '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [isInventoryLoading, setIsInventoryLoading] = useState(true)
  const [deletedProductCount, setDeletedProductCount] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inventoryRequestId = useRef(0)
  const c = useColors()
  const session = getClientSession()

  const notify = (message: string, tone: Toast['tone'] = 'success') => {
    if (toastTimeout.current) window.clearTimeout(toastTimeout.current)
    setToast({ message, tone })
    toastTimeout.current = window.setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => () => {
    if (toastTimeout.current) window.clearTimeout(toastTimeout.current)
  }, [])

  const toastNode = toast && (
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, maxWidth: 'calc(100vw - 32px)', padding: '12px 16px', borderRadius: 12, background: toast.tone === 'success' ? '#2E7D32' : '#B71C1C', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      {toast.message}
    </div>
  )

  const getStatus = (stock: number, reorder: number): ProductItem['status'] => {
    if (stock === 0 || (reorder > 0 && stock <= reorder * 0.3)) return 'critical'
    if (reorder > 0 && stock <= reorder) return 'low'
    return 'good'
  }

  useEffect(() => {
    if (!session) {
      setDataError('Please sign in to load inventory.')
      setIsInventoryLoading(false)
      return
    }
    const requestId = ++inventoryRequestId.current
    setIsInventoryLoading(true)
    setDataError('')
    Promise.all([
      apiFetch<Array<{ id: string; name: string; emoji: string | null; barcode: string | null; costPrice: number | null; sellingPrice: number | null; minimumStock: number | null; deletedAt?: string | null; category: { id: string; name: string; emoji: string | null } | null; inventory: { quantity: number } | null }>>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}${showDeleted ? '&includeDeleted=true' : ''}`),
      apiFetch<CategoryItem[]>(`/api/categories?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<Array<{ id: string }>>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}&includeDeleted=true`),
    ]).then(([productRows, categoryRows, deletedProducts]) => {
      if (requestId !== inventoryRequestId.current) return
      setDeletedProductCount(deletedProducts.length)
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
          deletedAt: product.deletedAt,
        }
      }))
    }).catch(reason => {
      if (requestId !== inventoryRequestId.current) return
      setDataError(reason instanceof Error ? reason.message : 'Unable to load inventory.')
    }).finally(() => {
      if (requestId === inventoryRequestId.current) setIsInventoryLoading(false)
    })
  }, [session?.user.businessId, showDeleted])

  useEffect(() => {
    if (!session || !showManageCategories) return
    apiFetch<CategoryItem[]>(`/api/categories?businessId=${encodeURIComponent(session.user.businessId)}&includeDeleted=true`)
      .then(setDeletedCategories)
      .catch(() => setDeletedCategories([]))
  }, [session?.user.businessId, showManageCategories])

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

  const toggleDeletedProducts = () => {
    setIsInventoryLoading(true)
    setShowDeleted(previous => !previous)
  }

  const openEditProduct = (product: ProductItem) => {
    setProductForm({
      name: product.name,
      categoryId: product.categoryId ?? '',
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
      reorder: String(product.reorder),
      barcode: product.barcode ?? '',
      emoji: product.emoji,
    })
    setEditProduct(product)
    setSelected(null)
    setShowAddProduct(true)
  }

  const deleteProduct = async (product: ProductItem) => {
    if (!session || !window.confirm(`Move "${product.name}" to deleted items? You can restore it later.`)) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch(`/api/products?id=${encodeURIComponent(product.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setProducts(previous => previous.filter(item => item.id !== product.id))
      setDeletedProductCount(previous => previous + 1)
      setSelected(current => current?.id === product.id ? null : current)
      notify('Product deleted.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete product.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const restoreProduct = async (product: ProductItem) => {
    if (!session) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/products', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, id: product.id, restore: true }) })
      setProducts(previous => previous.filter(item => item.id !== product.id))
      setDeletedProductCount(previous => Math.max(0, previous - 1))
      notify('Product restored.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to restore product.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveCategoryName = async (category: CategoryItem) => {
    if (!session) return
    const name = editingCategoryName.trim()
    if (!name || name === category.name) {
      setEditingCategoryId(null)
      return
    }
    setSaving(true)
    setDataError('')
    try {
      const updated = await apiFetch<CategoryItem>('/api/categories', {
        method: 'PATCH',
        body: JSON.stringify({ businessId: session.user.businessId, id: category.id, name }),
      })
      setCategories(previous => previous.map(item => item.id === updated.id ? updated : item))
      setProducts(previous => previous.map(product =>
        product.categoryId === updated.id ? { ...product, category: updated.name, emoji: product.emoji || updated.emoji || '📦' } : product,
      ))
      setEditingCategoryId(null)
      notify('Category updated.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to update category.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (category: CategoryItem) => {
    if (!session || !window.confirm(`Move category "${category.name}" to deleted items? Categories with products cannot be deleted.`)) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch(`/api/categories?id=${encodeURIComponent(category.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setCategories(previous => previous.filter(item => item.id !== category.id))
      setDeletedCategories(previous => [...previous, { ...category, deletedAt: new Date().toISOString() }])
      notify('Category deleted.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete category.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const restoreCategory = async (category: CategoryItem) => {
    if (!session) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/categories', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, id: category.id, restore: true }) })
      setDeletedCategories(previous => previous.filter(item => item.id !== category.id))
      setCategories(previous => [...previous, { ...category, deletedAt: null }].sort((a, b) => a.name.localeCompare(b.name)))
      notify('Category restored.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to restore category.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const createInlineCategory = async () => {
    if (!session || !newCat.name.trim()) return
    setSaving(true)
    setDataError('')
    try {
      const category = await apiFetch<CategoryItem>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ businessId: session.user.businessId, name: newCat.name.trim(), emoji: newCat.emoji }),
      })
      setCategories(previous => [...previous, category].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCat({ name: '', emoji: '📦' })
      notify('Category added.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to save category.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (selected) {
    const margin = Math.round((selected.price - selected.cost) / selected.price * 100)
    return (
      <div className="screen" style={{ background: c.bg }}>
        {toastNode}
        <div
          style={{
            background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
            padding: "52px 20px 24px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <button
              className="btn"
              onClick={() => {
                setSelected(null);
                onNavigate("inventory");
              }}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
              Product Details
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              {selected.emoji}
            </div>
            <div>
              <div style={{ color: "white", fontSize: 18, fontWeight: 800 }}>
                {selected.name}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {selected.category}
              </div>
            </div>
          </div>
        </div>
        <div
          className="scroll-area"
          style={{ padding: "16px", paddingBottom: 80 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: "Cost Price",
                value: `KSh ${selected.cost}`,
                color: "#D32F2F",
              },
              {
                label: "Selling Price",
                value: `KSh ${selected.price}`,
                color: "#123A8F",
              },
              { label: "Profit Margin", value: `${margin}%`, color: "#2E7D32" },
              {
                label: "Current Stock",
                value: `${selected.stock} units`,
                color:
                  selected.status === "critical"
                    ? "#D32F2F"
                    : selected.status === "low"
                      ? "#F9A825"
                      : "#2E7D32",
              },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "16px", marginBottom: 14 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: c.text,
                marginBottom: 12,
              }}
            >
              Stock Information
            </div>
            {[
              ["Reorder Level", `${selected.reorder} units`],
              [
                "Stock Status",
                selected.status === "critical"
                  ? "🔴 Critical"
                  : selected.status === "low"
                    ? "🟡 Low Stock"
                    : "🟢 In Stock",
              ],
              [
                "Units Below Reorder",
                selected.stock < selected.reorder
                  ? `${selected.reorder - selected.stock} units`
                  : "None",
              ],
            ].map(([k, v], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < 2 ? c.divider : "none",
                }}
              >
                <div style={{ fontSize: 13, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              onClick={() => openEditProduct(selected)}
              style={{
                flex: 1,
                padding: "14px",
                background: "rgba(18,58,143,0.1)",
                border: "1px solid #123A8F",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 600,
                color: "#123A8F",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Edit Product
            </button>
            <button
              className="btn"
              onClick={() => void deleteProduct(selected)}
              disabled={saving}
              style={{
                padding: "14px",
                background: c.errorBg,
                border: "1px solid #D32F2F",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                color: "#D32F2F",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Delete
            </button>
            <button
              className="btn"
              onClick={() => onNavigate("purchases")}
              style={{
                flex: 1,
                padding: "14px",
                background: "linear-gradient(135deg, #123A8F, #1A4FBF)",
                border: "none",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Purchase Order
            </button>
          </div>
        </div>
      </div>
    );
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
      notify(editProduct ? 'Product updated.' : 'Product added.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to save product.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (showManageCategories) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        {toastNode}
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => { setShowManageCategories(false); setEditingCategoryId(null) }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Back to inventory">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Manage Categories</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
          {dataError && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Categories</div>
            {categories.length === 0 && <div style={{ padding: '12px 0', color: c.muted, fontSize: 13 }}>No categories yet.</div>}
            {categories.map((category, index) => {
              const isEditing = editingCategoryId === category.id
              const count = products.filter(product => product.categoryId === category.id).length
              return (
                <div key={category.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: index < categories.length - 1 ? c.divider : 'none' }}>
                  <div style={{ width: 28, textAlign: 'center', fontSize: 17 }}>{category.emoji ?? '📦'}</div>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="input"
                      value={editingCategoryName}
                      onChange={event => setEditingCategoryName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') void saveCategoryName(category)
                        if (event.key === 'Escape') setEditingCategoryId(null)
                      }}
                      style={{ flex: 1, padding: '7px 9px', fontSize: 13 }}
                    />
                  ) : <div style={{ flex: 1, fontSize: 13, color: c.text, fontWeight: 600 }}>{category.name}</div>}
                  <div style={{ fontSize: 11, color: c.faint, whiteSpace: 'nowrap' }}>{count} item{count === 1 ? '' : 's'}</div>
                  {isEditing ? (
                      <button className="btn" onClick={() => void saveCategoryName(category)} disabled={saving} style={{ width: 30, height: 30, borderRadius: 8, background: '#123A8F', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 800 }}>✓</button>
                    ) : (
                      <button className="btn" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name) }} aria-label={`Edit ${category.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                    )}
                    <button className="btn" onClick={() => void deleteCategory(category)} disabled={saving} aria-label={`Delete ${category.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></button>
                </div>
              )
            })}
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 14, opacity: deletedCategories.length ? 0.8 : 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deleted Categories</div>
            {deletedCategories.length === 0 && <div style={{ padding: '6px 0', color: c.muted, fontSize: 13 }}>No deleted categories.</div>}
            {deletedCategories.map((category, index) => <div key={category.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: index < deletedCategories.length - 1 ? c.divider : 'none' }}>
              <div style={{ flex: 1, fontSize: 13, color: c.muted, textDecoration: 'line-through' }}>{category.emoji ?? '📦'} {category.name}</div>
              <button className="btn" onClick={() => void restoreCategory(category)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 8, background: c.successBg, border: 'none', color: '#2E7D32', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Restore</button>
            </div>)}
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Add New Category</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="Category name..." value={newCat.name} onChange={event => setNewCat(previous => ({ ...previous, name: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void createInlineCategory() }} style={{ flex: 1 }} />
              <button className="btn" onClick={() => void createInlineCategory()} disabled={saving || !newCat.name.trim()} aria-label="Add category" style={{ width: 42, height: 42, borderRadius: 10, background: '#123A8F', color: 'white', border: 'none', cursor: 'pointer', fontSize: 22 }}>+</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Add Category modal
  if (showAddCategory) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        {toastNode}
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
              notify('Category added.')
            } catch (reason) {
              const message = reason instanceof Error ? reason.message : 'Unable to save category.'
              setDataError(message)
              notify(message, 'error')
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
        {toastNode}
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
        {toastNode}
      {dataError && <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Inventory</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowManageCategories(true)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Categories</button>
            {!showDeleted && <button className="btn" onClick={() => { setProductForm({ name: '', categoryId: categories[0]?.id ?? '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' }); setEditProduct(null); setShowAddProduct(true) }} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16, color: '#0D1B3D', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Product</span>
            </button>}
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
        {isInventoryLoading ? [0, 1, 2, 3].map(index => (
          <div key={index} className="card" style={{ height: 70, marginBottom: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.55 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}><div style={{ width: '58%', height: 12, borderRadius: 6, background: c.iconBg, marginBottom: 9 }} /><div style={{ width: '40%', height: 10, borderRadius: 5, background: c.iconBg }} /></div>
            <div style={{ width: 56, height: 30, borderRadius: 8, background: c.iconBg }} />
          </div>
        )) : filtered.map(p => (
          <div key={p.id} className="card" style={{
            width: '100%', marginBottom: 8, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{p.emoji}</div>
            <button className="btn" onClick={() => setSelected(p)} style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: c.muted }}>{p.category} · Cost: KSh {p.cost}</div>
            </button>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#123A8F', marginBottom: 3 }}>KSh {p.price}</div>
              <span className={`badge ${p.status === 'critical' ? 'badge-error' : p.status === 'low' ? 'badge-warning' : 'badge-success'}`}>
                {p.stock} units
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {showDeleted ? <button className="btn" onClick={() => void restoreProduct(p)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 8, background: c.successBg, border: 'none', color: '#2E7D32', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Restore</button> : <>
                <button className="btn" onClick={() => openEditProduct(p)} aria-label={`Edit ${p.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2 2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                <button className="btn" onClick={() => void deleteProduct(p)} disabled={saving} aria-label={`Delete ${p.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></button>
              </>}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, paddingTop: 12, borderTop: c.divider, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: c.muted, fontWeight: 500 }}>
            {deletedProductCount} deleted product{deletedProductCount === 1 ? '' : 's'}
          </div>
          <button className="btn" onClick={toggleDeletedProducts} disabled={isInventoryLoading} style={{ padding: '6px 12px', borderRadius: 8, background: showDeleted ? c.iconBg : c.cardAlt, border: 'none', fontSize: 11, fontWeight: 600, color: showDeleted ? '#123A8F' : c.muted, cursor: isInventoryLoading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {showDeleted ? 'Hide deleted' : 'Show deleted'}
          </button>
        </div>
        <button className="btn" onClick={() => setShowManageCategories(true)} style={{ width: '100%', marginTop: 10, padding: '12px', background: c.cardAlt, border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          Manage Categories
        </button>
      </div>

      {/* FAB */}
      {!showDeleted && <div style={{ position: 'absolute', bottom: 80, right: 16 }}>
        <button className="btn" onClick={() => { setProductForm({ name: '', categoryId: categories[0]?.id ?? '', cost: '', price: '', stock: '', reorder: '', barcode: '', emoji: '📦' }); setEditProduct(null); setShowAddProduct(true) }} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
          border: 'none', fontSize: 24, color: '#0D1B3D',
          boxShadow: '0 4px 16px rgba(212,175,55,0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>+</button>
      </div>}
    </div>
  )
}
