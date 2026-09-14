import { useState, useEffect, useRef } from 'react'
import { useColors } from '../utils/theme'

const productDB: Record<string, { name: string; barcode: string; category: string; price: number; stock: number; supplier: string; emoji: string; status: string }> = {
  '6001068023227': { name: 'Unga Jogoo 2kg',   barcode: '6001068023227', category: 'Flour',    price: 200, stock: 45, supplier: 'Unga Limited',   emoji: '🌾', status: 'good'     },
  '6009876541230': { name: 'Milk 500ml',        barcode: '6009876541230', category: 'Dairy',    price: 100, stock: 60, supplier: 'Brookside Dairy', emoji: '🥛', status: 'good'     },
  '6001253001021': { name: 'Cooking Oil 1L',    barcode: '6001253001021', category: 'Oils',     price: 190, stock: 32, supplier: 'Bidco Africa',    emoji: '🫙', status: 'good'     },
  '6002200022220': { name: 'Panadol 500mg',     barcode: '6002200022220', category: 'Pharma',   price: 30,  stock: 3,  supplier: 'Dawa Limited',    emoji: '💊', status: 'critical' },
  '6005001234567': { name: 'Sugar 1kg',         barcode: '6005001234567', category: 'Sugar',    price: 140, stock: 28, supplier: 'Mumias Sugar',    emoji: '🍬', status: 'low'      },
  '6006543219876': { name: 'Royco 75g',         barcode: '6006543219876', category: 'Spices',   price: 45,  stock: 5,  supplier: 'Unilever Kenya',  emoji: '🌶️', status: 'critical' },
  '6007112233445': { name: 'Blue Band 500g',    barcode: '6007112233445', category: 'Spreads',  price: 150, stock: 18, supplier: 'Bidco Africa',    emoji: '🧈', status: 'low'      },
  '6008998877661': { name: 'Omo 400g',          barcode: '6008998877661', category: 'Detergent',price: 180, stock: 8,  supplier: 'P&G Kenya',       emoji: '🧺', status: 'low'      },
}

const recentScans = [
  { name: 'Unga Jogoo 2kg',  barcode: '6001068023227', action: 'Added to cart',   time: '14:32', emoji: '🌾' },
  { name: 'Milk 500ml',      barcode: '6009876541230', action: 'Stock adjusted',  time: '14:18', emoji: '🥛' },
  { name: 'Cooking Oil 1L',  barcode: '6001253001021', action: 'Price checked',   time: '13:55', emoji: '🫙' },
]

const demoSequence = Object.keys(productDB)

interface Props { onNavigate: (s: string) => void }

type Mode = 'idle' | 'scanning' | 'result' | 'unknown' | 'manual'

export default function SmartScanScreen({ onNavigate }: Props) {
  const [mode, setMode]       = useState<Mode>('idle')
  const [scanned, setScanned] = useState<string>('')
  const [product, setProduct] = useState<typeof productDB[string] | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [manualInput, setManualInput]   = useState('')
  const [flash, setFlash]               = useState(false)
  const [addedToCart, setAddedToCart]   = useState(false)
  const [demoIdx, setDemoIdx]           = useState(0)
  const [scanLog, setScanLog]           = useState(recentScans)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const c = useColors()

  // Animate scanning progress
  const startScan = (barcode?: string) => {
    setMode('scanning')
    setScanProgress(0)
    setAddedToCart(false)
    let p = 0
    intervalRef.current = setInterval(() => {
      p += Math.random() * 22 + 8
      setScanProgress(Math.min(p, 100))
      if (p >= 100) {
        clearInterval(intervalRef.current!)
        const code = barcode ?? demoSequence[demoIdx % demoSequence.length]
        setDemoIdx(i => i + 1)
        setScanned(code)
        const found = productDB[code]
        setFlash(true)
        setTimeout(() => setFlash(false), 200)
        if (found) {
          setProduct(found)
          setMode('result')
          setScanLog(prev => [{
            name: found.name, barcode: code,
            action: 'Price checked', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            emoji: found.emoji,
          }, ...prev.slice(0, 4)])
        } else {
          setProduct(null)
          setMode('unknown')
        }
      }
    }, 80)
  }

  const handleManual = () => {
    const code = manualInput.trim()
    if (!code) return
    setManualInput('')
    setMode('manual')
    startScan(code)
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

        {/* ── Viewfinder ── */}
        <div style={{ position: 'relative', height: 240, background: '#060E1F', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* grid lines */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(18,58,143,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(18,58,143,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          {/* flash overlay */}
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.3, zIndex: 10 }} />}

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
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>Tap to simulate a barcode scan</div>
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
            <button className="btn" onClick={() => mode === 'idle' ? startScan() : reset()}
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
                  { label: 'Supplier', value: product.supplier.split(' ')[0], color: c.muted },
                ].map((s, i) => (
                  <div key={i} style={{ background: c.cardAlt, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: c.muted, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Primary actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button className="btn" onClick={() => { setAddedToCart(true) }} style={{ padding: '11px 6px', background: addedToCart ? c.successBg : 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 18 }}>{addedToCart ? '✅' : '🛒'}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: addedToCart ? '#2E7D32' : 'white' }}>{addedToCart ? 'Added!' : 'Add to Cart'}</span>
                </button>
                <button className="btn" onClick={() => onNavigate('purchases')} style={{ padding: '11px 6px', background: c.successBg, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32' }}>Restock</span>
                </button>
                <button className="btn" onClick={() => onNavigate('inventory')} style={{ padding: '11px 6px', background: c.iconBg, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
                <button className="btn" onClick={() => onNavigate('inventory')} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Add Product</button>
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
                { icon: '📊', count: 47, label: 'Barcode Scans', color: '#123A8F' },
                { icon: '🔍', count: 3,  label: 'Unknown',       color: '#D32F2F' },
                { icon: '✏️', count: 12, label: 'Manual Entry',  color: '#F9A825' },
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

            {/* Quick scan barcodes */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Quick Scan (tap any barcode)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(productDB).map(([code, p]) => (
                <button key={code} className="btn" onClick={() => startScan(code)}
                  style={{ padding: '6px 12px', background: c.card, border: '1.5px solid #E8ECF4', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 14 }}>{p.emoji}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: c.muted }}>{code.slice(-5)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
