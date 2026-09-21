import { useState, useEffect, useRef, useId } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type ScannedProduct = { name: string; barcode: string; category: string | null; price: number; stock: number; supplier: { name: string } | null; emoji: string; status: string; id: string }
type ScanLog = { name: string; barcode: string; action: string; time: string; emoji: string }
type ScanResponse = { found?: boolean; product: ScannedProduct | null; status: string }
type CartItemSeed = { id: string; name: string; price: number; emoji: string }

interface Props { onNavigate: (s: string, options?: { barcode?: string; productId?: string; cartItem?: CartItemSeed }) => void }

type Mode = 'idle' | 'camera' | 'scanning' | 'result' | 'unknown' | 'manual'

export default function SmartScanScreen({ onNavigate }: Props) {
  const [mode, setMode]       = useState<Mode>('idle')
  const [scanned, setScanned] = useState<string>('')
  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [manualInput, setManualInput]   = useState('')
  const [cameraError, setCameraError]   = useState('')
  const [flash, setFlash]               = useState(false)
  const [addedToCart, setAddedToCart]   = useState(false)
  const [scanLog, setScanLog]           = useState<ScanLog[]>([])
  const [scanCounts, setScanCounts]     = useState<Record<string, number>>({})
  const [error, setError]               = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledCameraScanRef = useRef(false)
  const viewfinderId = `smartscan-viewfinder-${useId().replace(/:/g, '')}`
  const c = useColors()

  useEffect(() => {
    const session = getClientSession()
    if (!session) {
      setError('Please sign in to use SmartScan.')
      return
    }
    apiFetch<{ scanActivity: { counts: Record<string, number>; recent: Array<{ name: string; barcode: string; status: string; emoji: string | null; createdAt: string }> } }>(`/api/dashboard/summary?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(response => {
        setScanCounts(response.scanActivity.counts)
        setScanLog(response.scanActivity.recent.map(scan => ({
          name: scan.name,
          barcode: scan.barcode,
          action: scan.status === 'UNKNOWN' ? 'Not found' : scan.status === 'MANUAL' ? 'Manual lookup' : 'Price checked',
          time: new Date(scan.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          emoji: scan.emoji ?? '📦',
        })))
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load scan activity.'))
  }, [])

  const lookup = async (code: string, statusOverride = 'AUTO') => {
    const session = getClientSession()
    if (!session) throw new Error('Please sign in to use SmartScan.')
    const response = await apiFetch<ScanResponse>('/api/scans', {
      method: 'POST',
      body: JSON.stringify({ businessId: session.user.businessId, barcode: code, statusOverride, action: 'LOOKUP' }),
    })
    setScanned(code)
    const found = response.found === true || response.status === 'FOUND' || response.product !== null
    setProduct(response.product)
    setMode(found ? 'result' : 'unknown')
    setScanLog(previous => [{
      name: response.product?.name ?? 'Unknown Product', barcode: code,
      action: found ? (statusOverride === 'MANUAL' ? 'Manual lookup' : 'Price checked') : 'Not found',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      emoji: response.product ? '📦' : '❓',
    }, ...previous.filter(item => item.barcode !== code).slice(0, 9)])
    setScanCounts(previous => ({ ...previous, [found ? (statusOverride === 'MANUAL' ? 'MANUAL' : 'FOUND') : 'UNKNOWN']: (previous[found ? (statusOverride === 'MANUAL' ? 'MANUAL' : 'FOUND') : 'UNKNOWN'] ?? 0) + 1 }))
  }

  // Animate scanning progress, then resolve the barcode against the database.
  const startScan = (barcode?: string, statusOverride = 'AUTO') => {
    setMode('scanning')
    setScanProgress(0)
    setAddedToCart(false)
    let p = 0
    intervalRef.current = setInterval(() => {
      p += Math.random() * 22 + 8
      setScanProgress(Math.min(p, 100))
      if (p >= 100) {
        clearInterval(intervalRef.current!)
        const code = barcode ?? window.prompt('Enter barcode to scan')?.trim() ?? ''
        if (!code) { setMode('idle'); return }
        setFlash(true)
        setTimeout(() => setFlash(false), 200)
        lookup(code, statusOverride).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Scan lookup failed.'))
      }
    }, 80)
  }

  const stopCamera = async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.getState() === 2) await scanner.stop()
    } catch {
      // The browser may stop the camera while the component is closing.
    }
    try { scanner.clear() } catch { /* The viewfinder may already be gone. */ }
  }

  const startCamera = () => {
    setCameraError('')
    handledCameraScanRef.current = false
    setMode('camera')
  }

  useEffect(() => {
    if (mode !== 'camera') return
    const scanner = new Html5Qrcode(viewfinderId)
    scannerRef.current = scanner
    let disposed = false

    void scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 250, height: 180 }, aspectRatio: 1.5 },
      decodedText => {
        if (disposed || handledCameraScanRef.current) return
        handledCameraScanRef.current = true
        void stopCamera().finally(() => startScan(decodedText))
      },
      () => undefined,
    ).catch((reason: unknown) => {
      if (!disposed) setCameraError(reason instanceof Error ? reason.message : 'Unable to access the camera.')
    })

    return () => {
      disposed = true
      void stopCamera()
    }
  }, [mode, viewfinderId])

  const handleManual = () => {
    const code = manualInput.trim()
    if (!code) return
    setManualInput('')
    startScan(code, 'MANUAL')
  }

  const addToCart = async () => {
    if (!product) return
    const session = getClientSession()
    if (!session) return setError('Please sign in to add items to cart.')
    try {
      await apiFetch('/api/scans', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, barcode: product.barcode, action: 'ADD_TO_CART' }) })
      setAddedToCart(true)
      onNavigate('pos', { cartItem: { id: product.id, name: product.name, price: product.price, emoji: product.emoji } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add item to cart.')
    }
  }

  const restock = async () => {
    if (!product) return
    const quantity = Number(window.prompt('Quantity to restock', '1'))
    const session = getClientSession()
    if (!session || !Number.isInteger(quantity) || quantity <= 0) return
    try {
      const response = await apiFetch<ScanResponse & { product: ScannedProduct }>('/api/scans', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, userId: session.user.id, barcode: product.barcode, action: 'RESTOCK', quantity }) })
      setProduct(response.product)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to restock item.')
    }
  }

  const reset = () => { setMode('idle'); setScanned(''); setProduct(null); setAddedToCart(false) }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const statusStyle = (s: string) => s === 'critical' ? { bg: c.errorBg, color: '#C62828', label: 'Critical Stock' }
    : s === 'low' ? { bg: '#FFF8E1', color: '#F57F17', label: 'Low Stock' }
    : { bg: c.successBg, color: '#2E7D32', label: 'In Stock' }

  return (
    <div className="screen" style={{ background: '#0D1B3D', position: 'relative' }}>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D 0%, #0A1628 100%)', padding: '52px 20px 16px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('dashboard')}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>SmartScan™</div>
              <div style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#0D1B3D', letterSpacing: 0.5 }}>SMART</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 }}>Barcode · Product Lookup · Stock Check</div>
          </div>
          <button className="btn" onClick={() => setMode(mode === 'manual' ? 'idle' : 'manual')}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✏️ Manual
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: '0 0 80px' }}>
        {error && <div style={{ margin: '12px 16px 0', background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>{error}</div>}

        {/* ── Viewfinder ── */}
        <div style={{ position: 'relative', height: 240, background: '#060E1F', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* grid lines */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(18,58,143,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(18,58,143,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          {/* flash overlay */}
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.3, zIndex: 10 }} />}

          {mode === 'camera' && (
            <div style={{ position: 'absolute', inset: 0, background: '#060E1F', padding: 12 }}>
              <div id={viewfinderId} style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 }} />
              <div style={{ position: 'absolute', top: 22, left: 22, right: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ background: 'rgba(13,27,61,0.78)', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 11, fontWeight: 700 }}>Allow camera access</div>
                <button className="btn" onClick={() => { void stopCamera(); setMode('idle') }} style={{ background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
              {cameraError && <div style={{ position: 'absolute', bottom: 22, left: 22, right: 22, background: 'rgba(255,235,238,0.95)', color: '#C62828', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>{cameraError}</div>}
            </div>
          )}

          {mode === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Scan frame */}
              <div style={{ width: 180, height: 100, position: 'relative' }}>
                {[['0 0','top left'],['auto 0 0 0','bottom left'],['0 0 auto auto','top right'],['auto 0 0 auto','bottom right']].map(([pos, key]) => (
                  <div key={key} style={{ position: 'absolute', [pos.includes('auto 0 0 0') ? 'bottom' : pos.includes('0 0 auto auto') ? 'top' : pos.includes('auto 0 0 auto') ? 'bottom' : 'top']: 0, [key.includes('right') ? 'right' : 'left']: 0, width: 24, height: 24, borderTop: key.includes('top') ? '3px solid #D4AF37' : 'none', borderBottom: key.includes('bottom') ? '3px solid #D4AF37' : 'none', borderLeft: key.includes('left') ? '3px solid #D4AF37' : 'none', borderRight: key.includes('right') ? '3px solid #D4AF37' : 'none' }} />
                ))}
                {/* Scan line animation */}
                <div style={{ position: 'absolute', left: 4, right: 4, height: 2, background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', animation: 'scanline 2s ease-in-out infinite', top: '50%' }} />
              </div>
              <button className="btn" onClick={startCamera} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Scan a barcode or QR code with camera</button>
            </div>
          )}

          {mode === 'scanning' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', padding: '0 32px' }}>
              <div style={{ color: '#D4AF37', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>SCANNING…</div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #123A8F, #D4AF37)', borderRadius: 2, transition: 'width 0.08s', width: `${scanProgress}%` }} />
              </div>
              {/* animated barcode lines */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} style={{ width: i % 3 === 0 ? 3 : 2, background: '#D4AF37', opacity: 0.4 + Math.random() * 0.6, height: 20 + Math.random() * 20, borderRadius: 1 }} />
                ))}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{Math.round(scanProgress)}%</div>
            </div>
          )}

          {(mode === 'result' || mode === 'unknown') && product === null && mode === 'unknown' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>❓</div>
              <div style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>Product Not Found</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'monospace' }}>{scanned}</div>
            </div>
          )}

          {mode === 'result' && product && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 48 }}>{product.emoji}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 8, padding: '4px 12px' }}>
                <div style={{ fontSize: 11, color: '#D4AF37', fontFamily: 'monospace', letterSpacing: 1 }}>⚡ {scanned}</div>
              </div>
            </div>
          )}

          {/* Scan button */}
          {(mode === 'idle' || mode === 'result' || mode === 'unknown') && (
            <button className="btn" onClick={() => mode === 'idle' ? startCamera() : reset()}
              style={{ position: 'absolute', bottom: 12, right: 12, background: mode === 'idle' ? 'linear-gradient(135deg, #D4AF37, #F0D060)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: mode === 'idle' ? '#0D1B3D' : 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              {mode === 'idle' ? '📷 Scan' : '↺ Reset'}
            </button>
          )}
        </div>

        {/* ── CSS animation for scan line ── */}
        <style>{`
          @keyframes scanline {
            0%   { top: 10%; }
            50%  { top: 80%; }
            100% { top: 10%; }
          }
        `}</style>

        {/* ── Manual input bar ── */}
        {(mode === 'idle' || mode === 'manual') && (
          <div style={{ background: '#111C35', padding: '12px 16px', display: 'flex', gap: 10 }}>
            <input
              className="input"
              placeholder="Enter barcode manually..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManual()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: 'white', fontSize: 13 }}
            />
            <button className="btn" onClick={handleManual}
              style={{ padding: '0 16px', background: '#123A8F', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Look Up
            </button>
          </div>
        )}

        {/* ── Result card ── */}
        {mode === 'result' && product && (
          <div style={{ padding: '16px', background: c.bg }}>
            <div className="card" style={{ padding: '20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{product.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c.text, marginBottom: 3 }}>{product.name}</div>
                  <div style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace', marginBottom: 6 }}>{product.barcode} · {product.category}</div>
                  <span className="badge" style={{ background: statusStyle(product.status).bg, color: statusStyle(product.status).color }}>
                    {statusStyle(product.status).label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Price', value: `KSh ${product.price}`, color: '#123A8F' },
                  { label: 'Stock', value: `${product.stock} units`, color: product.status === 'critical' ? '#D32F2F' : product.status === 'low' ? '#F9A825' : '#2E7D32' },
                  { label: 'Supplier', value: product.supplier?.name?.split(' ')[0] ?? 'N/A', color: c.muted },
                ].map((s, i) => (
                  <div key={i} style={{ background: c.cardAlt, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: c.muted, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Primary actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button className="btn" onClick={addToCart} style={{ padding: '11px 6px', background: addedToCart ? c.successBg : 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 18 }}>{addedToCart ? '✅' : '🛒'}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: addedToCart ? '#2E7D32' : 'white' }}>{addedToCart ? 'Added!' : 'Add to Cart'}</span>
                </button>
                <button className="btn" onClick={restock} style={{ padding: '11px 6px', background: c.successBg, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32' }}>Restock</span>
                </button>
                <button className="btn" onClick={() => onNavigate('inventory', { productId: product.id })} style={{ padding: '11px 6px', background: c.iconBg, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 18 }}>👁️</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#123A8F' }}>View Details</span>
                </button>
              </div>

              <button className="btn" onClick={() => onNavigate('pos')} style={{ width: '100%', padding: '11px', background: c.cardAlt, border: c.divider, borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                More Actions →
              </button>
            </div>

            <button className="btn" onClick={() => startScan()} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
              Scan Next Product
            </button>
          </div>
        )}

        {/* ── Unknown product ── */}
        {mode === 'unknown' && (
          <div style={{ padding: '16px', background: c.bg }}>
            <div className="card" style={{ padding: '20px', marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>❓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 4 }}>Product Not Found</div>
              <div style={{ fontSize: 12, color: c.muted, fontFamily: 'monospace', background: c.cardAlt, borderRadius: 8, padding: '6px 12px', marginBottom: 16, display: 'inline-block' }}>{scanned}</div>
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 16 }}>This barcode isn't in your inventory yet.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => onNavigate('inventory', { barcode: scanned })} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Add Product</button>
                <button className="btn" onClick={reset} style={{ flex: 1, padding: '12px', background: c.cardAlt, border: c.divider, borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Idle state — scan stats + recents ── */}
        {mode === 'idle' && (
          <div style={{ padding: '16px', background: c.bg }}>

            {/* Today's scan activity */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Today's Scan Activity</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { icon: '📊', count: Object.values(scanCounts).reduce((total, count) => total + count, 0), label: 'Barcode Scans', color: '#123A8F' },
                { icon: '🔍', count: scanCounts.UNKNOWN ?? 0, label: 'Unknown', color: '#D32F2F' },
                { icon: '✏️', count: scanCounts.MANUAL ?? 0, label: 'Manual Entry', color: '#F9A825' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: c.muted, marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent scans */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Recent Scans</div>
            <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
              {scanLog.slice(0, 5).map((s, i, arr) => (
                <button key={i} className="btn" onClick={() => startScan(s.barcode)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 'none', borderBottom: i < arr.length - 1 ? c.divider : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: c.faint, fontFamily: 'monospace', marginTop: 1 }}>{s.barcode}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600 }}>{s.action}</div>
                    <div style={{ fontSize: 10, color: c.faint, marginTop: 2 }}>{s.time}</div>
                  </div>
                </button>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
