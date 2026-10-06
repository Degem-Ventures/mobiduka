import { useEffect, useRef, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'
import { Html5Qrcode } from 'html5-qrcode'
import { DEFAULT_INVENTORY_EMOJI, INVENTORY_EMOJIS } from '../utils/inventory-emojis'
import { composeProductDisplayName } from '../../lib/product-display-name'
import { defaultProductTypes, loadProductTypes, productTypesStorageKey, type ProductTypeOption } from '../utils/product-types'

type ProductItem = { id: string; name: string; brand: string; productType: string; packSize: string; categoryId: string | null; category: string; cost: number; price: number; stock: number; reorder: number; emoji: string; status: 'good' | 'low' | 'critical'; barcode: string | null; deletedAt?: string | null }
type CategoryItem = { id: string; name: string; emoji: string | null; deletedAt?: string | null }
type ProductApiRow = {
  id: string
  name: string
  brand: string | null
  productType: string | null
  packSize: string | null
  emoji: string | null
  barcode: string | null
  costPrice: number | null
  sellingPrice: number | null
  minimumStock: number | null
  deletedAt?: string | null
  category: { id: string; name: string; emoji: string | null } | null
  inventory: { quantity: number } | null
}
type Toast = { message: string; tone: 'success' | 'error' }
type PermanentDeleteTarget =
  | { kind: 'product'; item: ProductItem }
  | { kind: 'category'; item: CategoryItem }
const createProductForm = (categoryId = '', barcode = '') => ({
  name: '', brand: '', packSize: '', categoryId, cost: '', price: '', stock: '', reorder: '', barcode,
  emoji: DEFAULT_INVENTORY_EMOJI,
})

const sortProductsByCategoryThenName = (left: ProductItem, right: ProductItem) =>
  left.category.localeCompare(right.category) || left.name.localeCompare(right.name)

function PermanentDeleteDialog({
  target,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  target: PermanentDeleteTarget
  saving: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const c = useColors()
  const itemName = target.item.name

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(8, 18, 42, 0.62)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="permanent-delete-title"
        aria-describedby="permanent-delete-description"
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 22,
          borderRadius: 20,
          background: c.card,
          color: c.text,
          boxShadow: '0 24px 72px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 15, display: 'grid', placeItems: 'center', color: '#C62828', background: c.errorBg }}>
          <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="m19 6-1 14H6L5 6" />
            <path d="M10 11v5M14 11v5" />
          </svg>
        </div>
        <h2 id="permanent-delete-title" style={{ margin: '0 0 8px', fontSize: 18, lineHeight: 1.3, fontWeight: 800 }}>
          Permanently delete {target.kind}?
        </h2>
        <p id="permanent-delete-description" style={{ margin: '0 0 14px', color: c.muted, fontSize: 13, lineHeight: 1.55 }}>
          <strong style={{ color: c.text }}>{itemName}</strong> will be removed permanently and cannot be restored.
        </p>
        <div style={{ marginBottom: 18, padding: '10px 12px', borderRadius: 12, background: c.errorBg, color: '#A32323', fontSize: 12, lineHeight: 1.5 }}>
          {target.kind === 'product'
            ? 'Products linked to sales, purchases, stock movements, or scan history are protected and cannot be permanently deleted.'
            : 'Active products or child categories prevent deletion. Archived products stay safe but will become uncategorized.'}
        </div>
        {error && <div role="alert" style={{ marginBottom: 14, color: '#B71C1C', fontSize: 12, lineHeight: 1.45 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn" onClick={onCancel} disabled={saving} style={{ flex: 1, minHeight: 44, border: `1px solid ${c.border}`, borderRadius: 12, background: c.card, color: c.text, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            Keep {target.kind}
          </button>
          <button type="button" className="btn" onClick={onConfirm} disabled={saving} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 12, background: saving ? '#A9A9A9' : '#C62828', color: 'white', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </section>
    </div>
  )
}

interface Props {
  onNavigate: (s: string, options?: { barcode?: string }) => void
  initialBarcode?: string
  initialProductId?: string
}

export default function InventoryScreen({ onNavigate, initialBarcode, initialProductId }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [deletedProducts, setDeletedProducts] = useState<ProductItem[]>([])
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
  const [showManageProductTypes, setShowManageProductTypes] = useState(false)
  const [productTypes, setProductTypes] = useState<ProductTypeOption[]>([])
  const [productTypesLoaded, setProductTypesLoaded] = useState(false)
  const [newProductType, setNewProductType] = useState({ name: '', categoryId: '', sizes: '' })
  const [newSizesByType, setNewSizesByType] = useState<Record<string, string>>({})
  const [productIdentityExpanded, setProductIdentityExpanded] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [newCat, setNewCat] = useState({ name: '', emoji: DEFAULT_INVENTORY_EMOJI })
  const [productForm, setProductForm] = useState(() => createProductForm())
  const [showBulkCalculator, setShowBulkCalculator] = useState(false)
  const [bulkPurchase, setBulkPurchase] = useState({ boxPrice: '', unitsPerBox: '', boxes: '1' })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [emojiPickerCategoryId, setEmojiPickerCategoryId] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [isInventoryLoading, setIsInventoryLoading] = useState(true)
  const [deletedProductCount, setDeletedProductCount] = useState(0)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PermanentDeleteTarget | null>(null)
  const [permanentDeleteError, setPermanentDeleteError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null)
  // const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // const toastTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const toastTimeout = useRef<number | null>(null);

  const inventoryRequestId = useRef(0)
  const barcodeScannerRef = useRef<Html5Qrcode | null>(null)
  const inventoryScreenRef = useRef<HTMLDivElement | null>(null)
  const fabDragStart = useRef<{ pointerId: number; pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const fabWasDragged = useRef(false)
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

  const stopBarcodeCamera = async () => {
    const scanner = barcodeScannerRef.current
    barcodeScannerRef.current = null
    if (scanner) {
      try { await scanner.stop() } catch { /* Scanner may already have stopped after a successful decode. */ }
      try { scanner.clear() } catch { /* The video mount can already be unmounted. */ }
    }
    setShowBarcodeCamera(false)
  }

  const startBarcodeCamera = () => {
    setCameraError('')
    setShowBarcodeCamera(true)
  }

  useEffect(() => {
    if (!showBarcodeCamera) return
    let disposed = false
    const scanner = new Html5Qrcode('inventory-barcode-camera')
    barcodeScannerRef.current = scanner
    void scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 160 } }, decodedText => {
      if (disposed) return
      setProductForm(form => ({ ...form, barcode: decodedText }))
      notify('Barcode added to product.')
      void stopBarcodeCamera()
    }, () => undefined).catch(reason => { if (!disposed) setCameraError(reason instanceof Error ? reason.message : 'Unable to access the camera.') })
    return () => {
      disposed = true
      if (barcodeScannerRef.current !== scanner) return
      barcodeScannerRef.current = null
      void scanner.stop().catch(() => undefined).then(() => { try { scanner.clear() } catch { /* Camera mount is already gone. */ } })
    }
  }, [showBarcodeCamera])

  const toastNode = toast && (
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, maxWidth: 'calc(100vw - 32px)', padding: '12px 16px', borderRadius: 12, background: toast.tone === 'success' ? '#2E7D32' : '#B71C1C', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
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
      apiFetch<ProductApiRow[]>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<CategoryItem[]>(`/api/categories?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<ProductApiRow[]>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}&includeDeleted=true`),
    ]).then(([productRows, categoryRows, deletedRows]) => {
      if (requestId !== inventoryRequestId.current) return
      setDeletedProductCount(deletedRows.length)
      setCategories([...categoryRows].sort((left, right) => left.name.localeCompare(right.name)))
      const mapProduct = (product: typeof productRows[number]): ProductItem => {
        const stock = Number(product.inventory?.quantity ?? 0)
        const reorder = Number(product.minimumStock ?? 0)
        return {
          id: product.id,
          name: product.name,
          brand: product.brand ?? '',
          productType: product.productType ?? '',
          packSize: product.packSize ?? '',
          categoryId: product.category?.id ?? null,
          category: product.category?.name ?? 'Uncategorized',
          cost: Number(product.costPrice ?? 0),
          price: Number(product.sellingPrice ?? 0),
          stock,
          reorder,
          emoji: product.emoji ?? product.category?.emoji ?? DEFAULT_INVENTORY_EMOJI,
          status: getStatus(stock, reorder),
          barcode: product.barcode,
          deletedAt: product.deletedAt,
        }
      }
      setProducts(productRows.map(mapProduct).sort(sortProductsByCategoryThenName))
      setDeletedProducts(deletedRows.map(mapProduct).sort(sortProductsByCategoryThenName))
    }).catch(reason => {
      if (requestId !== inventoryRequestId.current) return
      setDataError(reason instanceof Error ? reason.message : 'Unable to load inventory.')
    }).finally(() => {
      if (requestId === inventoryRequestId.current) setIsInventoryLoading(false)
    })
  }, [session?.user.businessId])

  useEffect(() => {
    if (!session || !showManageCategories) return
    apiFetch<CategoryItem[]>(`/api/categories?businessId=${encodeURIComponent(session.user.businessId)}&includeDeleted=true`)
      .then(setDeletedCategories)
      .catch(() => setDeletedCategories([]))
  }, [session?.user.businessId, showManageCategories])

  useEffect(() => {
    if (!session?.user.businessId || isInventoryLoading) return
    const businessId = session.user.businessId
    try {
      setProductTypes(loadProductTypes(
        categories,
        window.localStorage.getItem(productTypesStorageKey(businessId)),
      ))
    } catch (reason) {
      notify(reason instanceof Error ? `Unable to load saved product types: ${reason.message}` : 'Unable to load saved product types.', 'error')
      setProductTypes(defaultProductTypes(categories))
    }
    setProductTypesLoaded(true)
  }, [categories, isInventoryLoading, session?.user.businessId])

  useEffect(() => {
    if (!productTypesLoaded || !session?.user.businessId) return
    try {
      window.localStorage.setItem(
        productTypesStorageKey(session.user.businessId),
        JSON.stringify(productTypes),
      )
    } catch (reason) {
      notify(reason instanceof Error ? `Unable to save product types: ${reason.message}` : 'Unable to save product types.', 'error')
    }
  }, [productTypes, productTypesLoaded, session?.user.businessId])

  useEffect(() => {
    if (!initialBarcode) return
    setProductForm(createProductForm(categories[0]?.id ?? '', initialBarcode))
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

  const toggleDeletedProducts = () => setShowDeleted(previous => !previous)

  const openEditProduct = (product: ProductItem) => {
    setProductForm({
      name: product.productType || product.name,
      brand: product.brand,
      packSize: product.packSize,
      categoryId: product.categoryId ?? '',
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
      reorder: String(product.reorder),
      barcode: product.barcode ?? '',
      emoji: product.emoji,
    })
    setEditProduct(product)
    setShowBulkCalculator(false)
    setProductIdentityExpanded(true)
    setBulkPurchase({ boxPrice: '', unitsPerBox: '', boxes: '1' })
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
      setDeletedProducts(previous => [...previous, { ...product, deletedAt: new Date().toISOString() }].sort(sortProductsByCategoryThenName))
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
      setDeletedProducts(previous => previous.filter(item => item.id !== product.id))
      setProducts(previous => [...previous, { ...product, deletedAt: null }].sort(sortProductsByCategoryThenName))
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

  const permanentlyDeleteItem = async () => {
    if (!session || !permanentDeleteTarget) return
    setSaving(true)
    setPermanentDeleteError('')
    try {
      const { kind, item } = permanentDeleteTarget
      const endpoint = kind === 'product' ? '/api/products' : '/api/categories'
      await apiFetch(
        `${endpoint}?id=${encodeURIComponent(item.id)}&businessId=${encodeURIComponent(session.user.businessId)}&hard=true`,
        { method: 'DELETE' },
      )
      if (kind === 'product') {
        setDeletedProducts(previous => previous.filter(product => product.id !== item.id))
        setDeletedProductCount(previous => Math.max(0, previous - 1))
      } else {
        setDeletedCategories(previous => previous.filter(category => category.id !== item.id))
      }
      setPermanentDeleteTarget(null)
      notify(`${kind === 'product' ? 'Product' : 'Category'} permanently deleted.`)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to permanently delete this item.'
      setPermanentDeleteError(message)
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
      setCategories(previous => previous.map(item => item.id === updated.id ? updated : item).sort((left, right) => left.name.localeCompare(right.name)))
      setProducts(previous => previous.map(product =>
        product.categoryId === updated.id ? { ...product, category: updated.name, emoji: product.emoji || updated.emoji || DEFAULT_INVENTORY_EMOJI } : product,
      ).sort(sortProductsByCategoryThenName))
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

  const saveCategoryEmoji = async (category: CategoryItem, emoji: string) => {
    if (!session) return
    setSaving(true)
    setDataError('')
    try {
      const updated = await apiFetch<CategoryItem>('/api/categories', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, id: category.id, emoji }) })
      setCategories(previous => previous.map(item => item.id === updated.id ? updated : item).sort((left, right) => left.name.localeCompare(right.name)))
      setProducts(previous => previous.map(product => product.categoryId === updated.id && product.emoji === (category.emoji ?? '📦') ? { ...product, emoji } : product))
      setEmojiPickerCategoryId(null)
      notify('Category icon updated.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to update category icon.'
      setDataError(message)
      notify(message, 'error')
    } finally { setSaving(false) }
  }

  const deleteCategory = async (category: CategoryItem) => {
    if (!session || !window.confirm(`Move category "${category.name}" to deleted items? Categories with products cannot be deleted.`)) return
    setSaving(true)
    setDataError('')
    try {
      await apiFetch(`/api/categories?id=${encodeURIComponent(category.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setCategories(previous => previous.filter(item => item.id !== category.id))
      setDeletedCategories(previous => [...previous, { ...category, deletedAt: new Date().toISOString() }].sort((left, right) => left.name.localeCompare(right.name)))
      notify('Category deleted.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete category.'
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
      setNewCat({ name: '', emoji: DEFAULT_INVENTORY_EMOJI })
      notify('Category added.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to save category.'
      setDataError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const applyBulkPurchase = () => {
    const boxPrice = Number(bulkPurchase.boxPrice)
    const unitsPerBox = Number(bulkPurchase.unitsPerBox)
    const boxes = Number(bulkPurchase.boxes || 1)
    if (!Number.isFinite(boxPrice) || boxPrice < 0 || !Number.isInteger(unitsPerBox) || unitsPerBox <= 0 || !Number.isInteger(boxes) || boxes <= 0) return
    setProductForm(form => ({ ...form, cost: (boxPrice / unitsPerBox).toFixed(2), stock: String(unitsPerBox * boxes) }))
  }

  if (selected) {
    const margin = Math.round((selected.price - selected.cost) / selected.price * 100)
    return (
        <div ref={inventoryScreenRef} className="screen" style={{ background: c.bg, position: 'relative' }}>
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
                {[selected.category, selected.productType, selected.packSize].filter(Boolean).join(' · ')}
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
  const stockCostValue = products.reduce((total, product) => total + product.stock * product.cost, 0)
  const stockSaleValue = products.reduce((total, product) => total + product.stock * product.price, 0)
  const expectedStockProfit = stockSaleValue - stockCostValue
  const formatStockValue = (value: number) => `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`

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
          brand: p.brand.trim() || null,
          productType: p.name.trim(),
          packSize: p.packSize.trim() || null,
          categoryId: p.categoryId,
          costPrice: Number(p.cost),
          sellingPrice: Number(p.price),
          stock: Number(p.stock),
          minimumStock: Number(p.reorder),
          barcode: p.barcode.trim() || null,
          emoji: p.emoji,
        }),
      })
      const refreshed = await apiFetch<ProductApiRow[]>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`)
      setProducts(refreshed.map(product => {
        const stock = Number(product.inventory?.quantity ?? 0)
        const reorder = Number(product.minimumStock ?? 0)
        return { id: product.id, name: product.name, brand: product.brand ?? '', productType: product.productType ?? '', packSize: product.packSize ?? '', categoryId: product.category?.id ?? null, category: product.category?.name ?? 'Uncategorized', cost: Number(product.costPrice ?? 0), price: Number(product.sellingPrice ?? 0), stock, reorder, emoji: product.emoji ?? product.category?.emoji ?? DEFAULT_INVENTORY_EMOJI, status: getStatus(stock, reorder), barcode: product.barcode }
      }).sort(sortProductsByCategoryThenName))
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

  const activeProductTypePreset = productTypes.find(
    preset => preset.name.toLowerCase() === productForm.name.trim().toLowerCase(),
  )
  const productDisplayName = composeProductDisplayName(
    productForm.brand,
    productForm.name,
    productForm.packSize,
  )
  const updateProductType = (name: string) => {
    const preset = productTypes.find(
      item => item.name.toLowerCase() === name.trim().toLowerCase(),
    )
    setProductForm(current => {
      const productNameChanged = current.name.trim().toLowerCase() !== name.trim().toLowerCase()
      return {
        ...current,
        name,
        ...(productNameChanged ? { packSize: '' } : {}),
        ...(preset
          ? {
              categoryId: preset.categoryId || current.categoryId,
              emoji: preset.emoji,
            }
          : {}),
      }
    })
  }
  const startNewProduct = () => {
    setProductForm(createProductForm(categories[0]?.id ?? ''))
    setBulkPurchase({ boxPrice: '', unitsPerBox: '', boxes: '1' })
    setShowBulkCalculator(false)
    setProductIdentityExpanded(false)
    setEditProduct(null)
    setShowAddProduct(true)
  }

  const addProductType = () => {
    const name = newProductType.name.trim()
    const categoryId = newProductType.categoryId
    const sizes = [...new Set(newProductType.sizes.split(',').map(size => size.trim()).filter(Boolean))]
    if (!name || !categoryId || sizes.length === 0) {
      notify('Enter a product type, choose its category, and add at least one pack size.', 'error')
      return
    }
    if (productTypes.some(type => type.name.toLowerCase() === name.toLowerCase())) {
      notify('That product type already exists. Add sizes to it instead.', 'error')
      return
    }
    const category = categories.find(item => item.id === categoryId)
    setProductTypes(previous => [...previous, {
      id: `custom-${Date.now()}`,
      name,
      categoryId,
      emoji: category?.emoji ?? DEFAULT_INVENTORY_EMOJI,
      sizes,
    }].sort((left, right) => left.name.localeCompare(right.name)))
    setNewProductType({ name: '', categoryId: '', sizes: '' })
    notify('Product type added.')
  }

  const addSizesToProductType = (type: ProductTypeOption) => {
    const entered = (newSizesByType[type.id] ?? '').split(',').map(size => size.trim()).filter(Boolean)
    const additions = entered.filter((size, index) =>
      entered.findIndex(candidate => candidate.toLowerCase() === size.toLowerCase()) === index,
    )
    if (!additions.length) return
    const duplicates = additions.filter(size => type.sizes.some(existing => existing.toLowerCase() === size.toLowerCase()))
    const uniqueAdditions = additions.filter(size => !type.sizes.some(existing => existing.toLowerCase() === size.toLowerCase()))
    if (!uniqueAdditions.length) {
      notify(duplicates.length ? 'Those pack sizes are already listed.' : 'Enter at least one pack size.', 'error')
      return
    }
    setProductTypes(previous => previous.map(item =>
      item.id === type.id ? { ...item, sizes: [...item.sizes, ...uniqueAdditions] } : item,
    ))
    setNewSizesByType(previous => ({ ...previous, [type.id]: '' }))
    notify(`Added ${uniqueAdditions.length} pack size${uniqueAdditions.length === 1 ? '' : 's'}${duplicates.length ? '; existing sizes were skipped' : ''}.`)
  }

  const removeProductTypeSize = (typeId: string, size: string) => {
    setProductTypes(previous => previous.map(type =>
      type.id === typeId ? { ...type, sizes: type.sizes.filter(item => item !== size) } : type,
    ))
  }

  const updateProductTypeCategory = (typeId: string, categoryId: string) => {
    const category = categories.find(item => item.id === categoryId)
    setProductTypes(previous => previous.map(type =>
      type.id === typeId
        ? { ...type, categoryId, emoji: category?.emoji ?? type.emoji }
        : type,
    ))
  }

  const startFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!inventoryScreenRef.current) return
    const screenRect = inventoryScreenRef.current.getBoundingClientRect()
    const buttonRect = event.currentTarget.getBoundingClientRect()
    const x = fabPosition?.x ?? buttonRect.left - screenRect.left
    const y = fabPosition?.y ?? buttonRect.top - screenRect.top
    fabDragStart.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, x, y }
    fabWasDragged.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveFab = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = fabDragStart.current
    const screen = inventoryScreenRef.current
    if (!start || !screen || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.pointerX
    const deltaY = event.clientY - start.pointerY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 6) fabWasDragged.current = true
    if (!fabWasDragged.current) return
    const width = event.currentTarget.offsetWidth
    const height = event.currentTarget.offsetHeight
    const maxY = Math.max(132, screen.clientHeight - height - 80)
    setFabPosition({
      x: Math.max(12, Math.min(screen.clientWidth - width - 12, start.x + deltaX)),
      y: Math.max(132, Math.min(maxY, start.y + deltaY)),
    })
  }

  const endFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (fabDragStart.current?.pointerId !== event.pointerId) return
    fabDragStart.current = null
    window.setTimeout(() => { fabWasDragged.current = false }, 0)
  }

  if (showManageProductTypes) {
    return (
      <div ref={inventoryScreenRef} className="screen" style={{ background: c.bg, position: 'relative' }}>
        {toastNode}
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowManageProductTypes(false)} aria-label="Back to inventory" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Product Types & Sizes</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>Reusable variant presets</div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: 16, paddingBottom: 100 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 8px 4px' }}>Saved Types</div>
          {productTypes.map(type => (
            <div key={type.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: c.iconBg, display: 'grid', placeItems: 'center', fontSize: 18 }}>{type.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{type.name}</div>
                  <select aria-label={`Category for ${type.name}`} value={type.categoryId} onChange={event => updateProductTypeCategory(type.id, event.target.value)} style={{ maxWidth: '100%', marginTop: 2, padding: 0, border: 'none', background: 'transparent', color: c.muted, fontSize: 11, outline: 'none' }}>
                    <option value="">Choose category</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: 10, color: c.faint, whiteSpace: 'nowrap' }}>{type.sizes.length} sizes</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {type.sizes.length === 0 && <span style={{ fontSize: 11, color: c.faint }}>No pack sizes added</span>}
                {type.sizes.map(size => (
                  <button key={size} type="button" className="btn" title={`Remove ${size}`} onClick={() => removeProductTypeSize(type.id, size)} style={{ padding: '5px 9px', borderRadius: 100, border: 'none', background: c.cardAlt, color: c.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {size}
                    <span aria-hidden="true"> ×</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <input className="input" aria-label={`Add sizes to ${type.name}`} placeholder="Add size, e.g. 750ml" value={newSizesByType[type.id] ?? ''} onChange={event => setNewSizesByType(previous => ({ ...previous, [type.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSizesToProductType(type) } }} style={{ flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 12 }} />
                <button className="btn" aria-label={`Add sizes to ${type.name}`} onClick={() => addSizesToProductType(type)} style={{ width: 38, borderRadius: 10, border: 'none', background: c.iconBg, color: '#123A8F', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
          ))}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 12 }}>Add Product Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Type name</label>
                <input className="input" maxLength={120} value={newProductType.name} onChange={event => setNewProductType(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Juice" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Category</label>
                <select className="input" value={newProductType.categoryId} onChange={event => setNewProductType(current => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Pack sizes</label>
            <input className="input" maxLength={300} value={newProductType.sizes} onChange={event => setNewProductType(current => ({ ...current, sizes: event.target.value }))} placeholder="250ml, 500ml, 1L" />
            <button className="btn" onClick={addProductType} disabled={saving} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add Type</button>
          </div>
        </div>
      </div>
    )
  }

  if (showManageCategories) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        {toastNode}
        {permanentDeleteTarget && <PermanentDeleteDialog target={permanentDeleteTarget} saving={saving} error={permanentDeleteError} onCancel={() => setPermanentDeleteTarget(null)} onConfirm={() => void permanentlyDeleteItem()} />}
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
                <div key={category.id} style={{ padding: '9px 0', borderBottom: index < categories.length - 1 ? c.divider : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn" onClick={() => setEmojiPickerCategoryId(current => current === category.id ? null : category.id)} aria-label={`Change icon for ${category.name}`} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: emojiPickerCategoryId === category.id ? c.iconBg : 'transparent', textAlign: 'center', fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>{category.emoji ?? '📦'}</button>
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
                {emojiPickerCategoryId === category.id && <div style={{ margin: '9px 0 2px 38px', padding: 9, maxHeight: 168, overflowY: 'auto', borderRadius: 10, background: c.cardAlt, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INVENTORY_EMOJIS.map(emoji => <button key={emoji} className="btn" onClick={() => void saveCategoryEmoji(category, emoji)} disabled={saving} aria-label={`Use ${emoji} for ${category.name}`} style={{ width: 30, height: 30, borderRadius: 8, border: category.emoji === emoji ? '2px solid #123A8F' : `1px solid ${c.border}`, background: c.card, fontSize: 16, cursor: 'pointer' }}>{emoji}</button>)}
                </div>}
                </div>
              )
            })}
          </div>
          {deletedCategories.length > 0 && <div className="card" style={{ padding: '16px', marginBottom: 14, border: `1px solid ${c.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deleted Categories</div>
              <div style={{ fontSize: 11, color: c.faint }}>{deletedCategories.length} archived</div>
            </div>
            {deletedCategories.map((category, index) => <div key={category.id} className="deleted-item-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px', margin: '0 -10px', border: '1px solid transparent', borderBottom: index < deletedCategories.length - 1 ? c.divider : '1px solid transparent', borderRadius: 12 }}>
              <div style={{ flex: '1 1 120px', minWidth: 0, fontSize: 13, color: c.muted }}>
                <span aria-hidden="true" style={{ marginRight: 7 }}>{category.emoji ?? '📦'}</span>{category.name}
                <div style={{ margin: '3px 0 0 25px', fontSize: 10, color: c.faint }}>Archived category</div>
              </div>
              <button className="btn" onClick={() => void restoreCategory(category)} disabled={saving} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, background: c.successBg, border: 'none', color: '#2E7D32', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></svg>
                Restore
              </button>
              <button className="btn deleted-item-permanent-action" onClick={() => { setPermanentDeleteError(''); setPermanentDeleteTarget({ kind: 'category', item: category }) }} disabled={saving} aria-label={`Permanently delete category ${category.name}`} title="Delete permanently" style={{ width: 36, height: 36, padding: 0, borderRadius: 10, background: c.errorBg, border: 'none', color: '#B71C1C', cursor: saving ? 'wait' : 'pointer', display: 'grid', placeItems: 'center' }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
              </button>
            </div>)}
          </div>}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 206, overflowY: 'auto', paddingRight: 2 }}>
              {INVENTORY_EMOJIS.map(e => {
                const selectedEmoji = newCat.emoji === e
                return <button key={e} type="button" className="btn" onClick={() => setNewCat(prev => ({ ...prev, emoji: e }))} style={{ width: 42, height: 42, borderRadius: 10, border: selectedEmoji ? '2px solid #123A8F' : `1px solid ${c.border}`, background: selectedEmoji ? 'rgba(18,58,143,0.08)' : c.card, fontSize: 22, cursor: 'pointer', boxShadow: selectedEmoji ? '0 0 0 2px rgba(18,58,143,0.12)' : 'none' }}>{e}</button>
              })}
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
              setCategories(prev => [...prev, category].sort((left, right) => left.name.localeCompare(right.name)))
              setNewCat({ name: '', emoji: DEFAULT_INVENTORY_EMOJI })
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
            <button className="btn" onClick={() => { setShowAddProduct(false); setEditProduct(null); setShowBulkCalculator(false); setBulkPurchase({ boxPrice: '', unitsPerBox: '', boxes: '1' }) }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{editProduct ? 'Edit Product' : 'Add Product'}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          {/* Emoji picker */}
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10 }}>Product Icon</div>
            <div role="radiogroup" aria-label="Product icon" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 198, overflowY: 'auto', paddingRight: 2, marginBottom: 10 }}>
              {INVENTORY_EMOJIS.map(e => {
                const selectedEmoji = productForm.emoji === e
                return <button key={e} type="button" role="radio" aria-checked={selectedEmoji} className="btn" onClick={() => setProductForm(f => ({ ...f, emoji: e }))} style={{ width: 40, height: 40, borderRadius: 10, border: selectedEmoji ? '2px solid #123A8F' : `1px solid ${c.border}`, background: selectedEmoji ? 'rgba(18,58,143,0.1)' : c.card, fontSize: 20, cursor: 'pointer', boxShadow: selectedEmoji ? '0 0 0 2px rgba(18,58,143,0.12)' : 'none' }}>{e}</button>
              })}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
            <button type="button" className="btn" onClick={() => setShowBulkCalculator(open => !open)} aria-expanded={showBulkCalculator} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, background: showBulkCalculator ? c.infoBg : c.card, border: 'none', color: c.text, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: c.iconBg, fontSize: 16 }}>📦</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>Bulk purchase calculator</span><span style={{ display: 'block', marginTop: 2, fontSize: 11, color: c.muted }}>Calculate unit cost and stock from a carton or box.</span></span>
              <span aria-hidden="true" style={{ fontSize: 16, color: '#123A8F', transform: showBulkCalculator ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
            </button>
            {showBulkCalculator && <div style={{ padding: '0 16px 16px', borderTop: c.divider }}>
              <div style={{ marginTop: 13, fontSize: 12, color: c.muted, lineHeight: 1.45 }}>Enter the wholesale price for one box and how many individual items it contains. We will populate the unit cost and current stock below.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 5 }}>Box Price (KSh)</label><input className="input" type="number" min="0" step="0.01" placeholder="e.g. 1,200" value={bulkPurchase.boxPrice} onChange={event => setBulkPurchase(value => ({ ...value, boxPrice: event.target.value }))} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 5 }}>Units per Box</label><input className="input" type="number" min="1" step="1" placeholder="e.g. 24" value={bulkPurchase.unitsPerBox} onChange={event => setBulkPurchase(value => ({ ...value, unitsPerBox: event.target.value }))} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 5 }}>Boxes Purchased</label><input className="input" type="number" min="1" step="1" value={bulkPurchase.boxes} onChange={event => setBulkPurchase(value => ({ ...value, boxes: event.target.value }))} /></div>
                <div style={{ display: 'flex', alignItems: 'end' }}><button type="button" className="btn" onClick={applyBulkPurchase} disabled={!bulkPurchase.boxPrice || !bulkPurchase.unitsPerBox || !bulkPurchase.boxes} style={{ width: '100%', padding: '12px 10px', border: 'none', borderRadius: 12, background: bulkPurchase.boxPrice && bulkPurchase.unitsPerBox && bulkPurchase.boxes ? '#123A8F' : c.cardAlt, color: bulkPurchase.boxPrice && bulkPurchase.unitsPerBox && bulkPurchase.boxes ? 'white' : c.faint, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Apply calculation</button></div>
              </div>
              {Number(bulkPurchase.boxPrice) >= 0 && Number(bulkPurchase.unitsPerBox) > 0 && Number(bulkPurchase.boxes) > 0 && <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: c.successBg, color: '#2E7D32', fontSize: 12, fontWeight: 700 }}>Unit cost: KSh {(Number(bulkPurchase.boxPrice) / Number(bulkPurchase.unitsPerBox)).toFixed(2)} · Stock: {Number(bulkPurchase.unitsPerBox) * Number(bulkPurchase.boxes)} units</div>}
            </div>}
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>Product Details</div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="inventory-product-brand" style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Brand <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input id="inventory-product-brand" className="input" maxLength={80} placeholder="e.g. Dairy Joy, Kristal, Afia" value={productForm.brand} onChange={e => setProductForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="inventory-product-name" style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Product Name *</label>
              <input id="inventory-product-name" className="input" maxLength={120} placeholder="e.g. Soda, Milk, Petroleum Jelly" value={productForm.name} onChange={event => updateProductType(event.target.value)} />
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
            <div style={{ borderTop: c.divider, paddingTop: 12 }}>
              <button type="button" className="btn" aria-expanded={productIdentityExpanded} onClick={() => setProductIdentityExpanded(open => !open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: activeProductTypePreset ? c.infoBg : c.cardAlt, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={activeProductTypePreset ? '#123A8F' : c.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12V8H4v4" /><path d="M12 4v16" /><path d="m8 16 4 4 4-4" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.text }}>Product Type &amp; Pack Size</span>
                  <span style={{ display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: c.muted }}>
                    {activeProductTypePreset ? `${activeProductTypePreset.name}${productForm.packSize ? ` · ${productForm.packSize}` : ' · Select a size'}` : 'Optional product variant'}
                  </span>
                </span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: productIdentityExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {productIdentityExpanded && <div style={{ paddingTop: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: activeProductTypePreset ? 12 : 10 }}>
                  {productTypes.map(type => {
                    const active = activeProductTypePreset?.id === type.id
                    return <button key={type.id} type="button" className="btn" aria-pressed={active} onClick={() => updateProductType(type.name)} style={{ padding: '8px 12px', borderRadius: 10, border: active ? '2px solid #123A8F' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, background: active ? c.infoBg : c.card, color: active ? (c.isDark ? '#90CAF9' : '#123A8F') : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{type.name}</button>
                  })}
                </div>
                {activeProductTypePreset && activeProductTypePreset.sizes.length > 0 && <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: c.muted, marginBottom: 7 }}>Select pack size</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {activeProductTypePreset.sizes.map(size => {
                      const active = productForm.packSize === size
                      return <button key={size} type="button" className="btn" aria-pressed={active} onClick={() => setProductForm(form => ({ ...form, packSize: active ? '' : size }))} style={{ minWidth: 54, padding: '7px 10px', borderRadius: 20, border: active ? '1.5px solid #D4AF37' : `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, background: active ? c.warningBg : c.card, color: active ? (c.isDark ? '#F0D060' : '#8B6914') : c.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{size}</button>
                    })}
                  </div>
                </div>}
                <button type="button" className="btn" onClick={() => setShowManageProductTypes(true)} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px dashed ${c.isDark ? '#31518E' : '#B0BAD3'}`, background: 'none', color: c.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Manage product types and sizes</button>
              </div>}
            </div>
            <div role="status" aria-live="polite" style={{ padding: '10px 12px', borderRadius: 10, background: c.cardAlt, border: `1px solid ${c.divider}`, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.muted, textTransform: 'uppercase', marginBottom: 3 }}>Display name</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{productDisplayName || 'Brand + product name + size'}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Barcode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" inputMode="numeric" placeholder="Scan or enter barcode" value={productForm.barcode} onChange={e => setProductForm(f => ({ ...f, barcode: e.target.value }))} style={{ flex: 1 }} />
                <button type="button" className="btn" onClick={startBarcodeCamera} aria-label="Scan barcode with camera" style={{ width: 44, borderRadius: 12, border: 'none', background: c.iconBg, color: '#123A8F', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
                </button>
              </div>
              {showBarcodeCamera && <div style={{ marginTop: 10, position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0D1B3D', minHeight: 190 }}>
                <div id="inventory-barcode-camera" style={{ width: '100%', minHeight: 190 }} />
                <button type="button" className="btn" onClick={() => void stopBarcodeCamera()} style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(13,27,61,0.75)', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                {cameraError && <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,235,238,0.96)', color: '#C62828', fontSize: 11 }}>{cameraError}</div>}
              </div>}
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
      <div ref={inventoryScreenRef} className="screen" style={{ background: c.bg, position: 'relative' }}>
        {toastNode}
        {permanentDeleteTarget && <PermanentDeleteDialog target={permanentDeleteTarget} saving={saving} error={permanentDeleteError} onCancel={() => setPermanentDeleteTarget(null)} onConfirm={() => void permanentlyDeleteItem()} />}
      {dataError && <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Inventory</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowManageCategories(true)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Categories</button>
            <button className="btn" onClick={startNewProduct} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16, color: '#0D1B3D', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Product</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Stock at Cost', value: formatStockValue(stockCostValue), icon: '📦', color: '#7FB0FF' },
            { label: 'Stock at Sale', value: formatStockValue(stockSaleValue), icon: '🏷️', color: '#8FE3A1' },
            { label: 'Expected Profit', value: formatStockValue(expectedStockProfit), icon: '📈', color: '#FFD93D' },
          ].map(metric => (
            <div key={metric.label} style={{ minWidth: 0, padding: '9px 8px', borderRadius: 11, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, margin: '0 auto 5px', borderRadius: 8, background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', fontSize: 15 }}>{metric.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.68)', lineHeight: 1.2 }}>{metric.label}</div>
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 800, color: metric.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metric.value}</div>
            </div>
          ))}
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
              <div style={{ fontSize: 11, color: c.muted }}>{[p.category, p.productType, p.packSize].filter(Boolean).join(' · ')} · Cost: KSh {p.cost}</div>
            </button>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#123A8F', marginBottom: 3 }}>KSh {p.price}</div>
              <span className={`badge ${p.status === 'critical' ? 'badge-error' : p.status === 'low' ? 'badge-warning' : 'badge-success'}`}>
                {p.stock} units
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <>
                <button className="btn" onClick={() => openEditProduct(p)} aria-label={`Edit ${p.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2 2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                <button className="btn" onClick={() => void deleteProduct(p)} disabled={saving} aria-label={`Delete ${p.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></button>
              </>
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
        {showDeleted && <div style={{ marginTop: 14, paddingTop: 14, borderTop: c.divider }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Deleted Products</div>
            <div style={{ fontSize: 11, color: c.muted }}>{deletedProducts.length} item{deletedProducts.length === 1 ? '' : 's'}</div>
          </div>
          {deletedProducts.length === 0 ? <div style={{ padding: '12px 0', fontSize: 12, color: c.muted, textAlign: 'center' }}>Your deleted products will appear here.</div> : deletedProducts.map(product => <div key={product.id} className="card deleted-item-row" style={{ marginBottom: 8, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, border: '1px solid transparent' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: c.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{product.emoji}</div>
            <div style={{ flex: '1 1 130px', minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{product.name}</div><div style={{ fontSize: 11, color: c.faint }}>{product.category} · KSh {product.price}</div></div>
            <div style={{ display: 'flex', gap: 7, marginLeft: 'auto' }}>
              <button className="btn" onClick={() => void restoreProduct(product)} disabled={saving} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, background: c.successBg, border: 'none', color: '#2E7D32', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></svg>
                Restore
              </button>
              <button className="btn deleted-item-permanent-action" onClick={() => { setPermanentDeleteError(''); setPermanentDeleteTarget({ kind: 'product', item: product }) }} disabled={saving} aria-label={`Permanently delete product ${product.name}`} title="Delete permanently" style={{ width: 36, height: 36, padding: 0, borderRadius: 10, background: c.errorBg, border: 'none', color: '#B71C1C', cursor: saving ? 'wait' : 'pointer', display: 'grid', placeItems: 'center' }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
              </button>
            </div>
          </div>)}
        </div>}
        <button className="btn" onClick={() => setShowManageCategories(true)} style={{ width: '100%', marginTop: 10, padding: '12px', background: c.cardAlt, border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          Manage Categories
        </button>
      </div>

      {/* FAB */}
      <div style={{ position: 'absolute', ...(fabPosition ? { left: fabPosition.x, top: fabPosition.y } : { bottom: 80, right: 16 }) }}>
        <button
          className="btn"
          aria-label="Add product (drag to reposition)"
          title="Drag to reposition · tap to add product"
          onPointerDown={startFabDrag}
          onPointerMove={moveFab}
          onPointerUp={endFabDrag}
          onPointerCancel={endFabDrag}
          onClick={() => { if (!fabWasDragged.current) startNewProduct() }}
          style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
          border: 'none', fontSize: 24, color: '#0D1B3D',
          boxShadow: '0 4px 16px rgba(212,175,55,0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none', userSelect: 'none',
        }}>+</button>
      </div>
    </div>
  )
}
