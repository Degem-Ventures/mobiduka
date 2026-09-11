import { useState } from 'react'

const products = [
  { id: 1, name: 'Unga Jogoo 2kg', price: 200, category: 'Flour', stock: 45, emoji: '🌾' },
  { id: 2, name: 'Cooking Oil 1L', price: 190, category: 'Oils', stock: 32, emoji: '🫙' },
  { id: 3, name: 'Sugar 1kg', price: 140, category: 'Sugar', stock: 28, emoji: '🍬' },
  { id: 4, name: 'Blue Band 500g', price: 150, category: 'Spreads', stock: 18, emoji: '🧈' },
  { id: 5, name: 'Milk 500ml', price: 100, category: 'Dairy', stock: 60, emoji: '🥛' },
  { id: 6, name: 'Royco 75g', price: 45, category: 'Spices', stock: 5, emoji: '🌶️' },
  { id: 7, name: 'Panadol 500mg', price: 30, category: 'Pharma', stock: 3, emoji: '💊' },
  { id: 8, name: 'Omo 400g', price: 180, category: 'Detergent', stock: 8, emoji: '🧺' },
  { id: 9, name: 'Colgate 100ml', price: 85, category: 'Personal', stock: 22, emoji: '🪥' },
  { id: 10, name: 'Bread White', price: 55, category: 'Bakery', stock: 15, emoji: '🍞' },
  { id: 11, name: 'Eggs (tray)', price: 480, category: 'Dairy', stock: 12, emoji: '🥚' },
  { id: 12, name: 'Nescafé 100g', price: 320, category: 'Beverages', stock: 9, emoji: '☕' },
]

const categories = ['All', 'Flour', 'Oils', 'Sugar', 'Dairy', 'Pharma', 'Beverages', 'Spreads', 'Spices', 'Bakery']

type CartItem = { id: number; name: string; price: number; qty: number; emoji: string }

interface Props {
  onNavigate: (screen: string) => void
}

export default function POSScreen({ onNavigate: _onNavigate }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'pos' | 'cart' | 'payment' | 'receipt'>('pos')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit'>('cash')
  const [discount, setDiscount] = useState(0)

  const filtered = products.filter(p =>
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (p: typeof products[0]) => {
    setCart(c => {
      const existing = c.find(x => x.id === p.id)
      if (existing) return c.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x)
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(c => c.map(x => x.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x).filter(x => x.qty > 0))
  }

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const discountAmt = Math.round(subtotal * discount / 100)
  const total = subtotal - discountAmt
  const cartCount = cart.reduce((s, x) => s + x.qty, 0)

  if (view === 'receipt') {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #2E7D32, #388E3C)', padding: '52px 20px 28px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>Sale Complete!</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>Receipt #{Math.floor(Math.random() * 9000) + 1000}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#6B7A99', marginBottom: 4 }}>MobiDuka Store · Nairobi CBD</div>
              <div style={{ fontSize: 12, color: '#B0BAD3' }}>Tue 8 Jul 2026, 14:45</div>
            </div>
            <div style={{ borderTop: '1px dashed #E8ECF4', paddingTop: 16, marginBottom: 16 }}>
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#0D1B3D' }}>{item.name} × {item.qty}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>KSh {item.price * item.qty}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px dashed #E8ECF4', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: '#6B7A99' }}>Subtotal</div>
                <div style={{ fontSize: 13, color: '#0D1B3D' }}>KSh {subtotal}</div>
              </div>
              {discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: '#D32F2F' }}>Discount ({discount}%)</div>
                  <div style={{ fontSize: 13, color: '#D32F2F' }}>-KSh {discountAmt}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '2px solid #123A8F', marginTop: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0D1B3D' }}>TOTAL</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#123A8F' }}>KSh {total.toLocaleString()}</div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>Payment</div>
                <span className={`badge ${paymentMethod === 'mpesa' ? 'badge-success' : paymentMethod === 'credit' ? 'badge-error' : 'badge-blue'}`}>
                  {paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'credit' ? 'Credit' : 'Cash'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn" style={{
              flex: 1, padding: '14px',
              background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F',
              borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#123A8F',
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Print Receipt</button>
            <button className="btn" onClick={() => { setCart([]); setView('pos'); setDiscount(0) }} style={{
              flex: 1, padding: '14px',
              background: 'linear-gradient(135deg, #123A8F, #1A4FBF)',
              border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, color: 'white',
              cursor: 'pointer', fontFamily: 'inherit'
            }}>New Sale</button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'payment') {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('cart')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Payment</div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Total Amount Due</div>
            <div style={{ color: '#D4AF37', fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>KSh {total.toLocaleString()}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{cartCount} items</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7A99', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Payment Method</div>
          {[
            { key: 'cash', label: 'Cash', sub: 'Physical cash payment', icon: '💵', color: '#123A8F' },
            { key: 'mpesa', label: 'M-Pesa', sub: 'Mobile money transfer', icon: '📱', color: '#2E7D32' },
            { key: 'credit', label: 'Credit / Tab', sub: 'Add to customer account', icon: '📋', color: '#D32F2F' },
          ].map(m => (
            <button key={m.key} className="btn" onClick={() => setPaymentMethod(m.key as 'cash' | 'mpesa' | 'credit')} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', marginBottom: 10, borderRadius: 14,
              background: paymentMethod === m.key ? `${m.color}12` : 'white',
              border: paymentMethod === m.key ? `2px solid ${m.color}` : '1.5px solid #E8ECF4',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: paymentMethod === m.key ? `0 0 0 4px ${m.color}10` : '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{m.icon}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1B3D' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>{m.sub}</div>
              </div>
              {paymentMethod === m.key && <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
              </div>}
            </button>
          ))}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7A99', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 5, 10, 15, 20].map(d => (
                <button key={d} className="btn" onClick={() => setDiscount(d)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 10,
                  background: discount === d ? '#123A8F' : 'white',
                  border: discount === d ? 'none' : '1.5px solid #E8ECF4',
                  color: discount === d ? 'white' : '#6B7A99',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}>{d}%</button>
              ))}
            </div>
          </div>

          <button className="btn" onClick={() => setView('receipt')} style={{
            width: '100%', marginTop: 28, padding: '18px',
            background: 'linear-gradient(135deg, #123A8F, #1A4FBF)',
            border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 800,
            color: 'white', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 6px 24px rgba(18,58,143,0.4)'
          }}>
            Complete Sale · KSh {total.toLocaleString()}
          </button>
        </div>
      </div>
    )
  }

  if (view === 'cart') {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('pos')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Cart ({cartCount} items)</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', flex: 1 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#B0BAD3' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7A99' }}>Cart is empty</div>
            </div>
          ) : cart.map((item) => (
            <div key={item.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E3EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{item.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>KSh {item.price} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn" onClick={() => updateQty(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#F0F3F9', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <div style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#0D1B3D' }}>{item.qty}</div>
                <button className="btn" onClick={() => updateQty(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#123A8F', border: 'none', cursor: 'pointer', fontSize: 16, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>
                KSh {(item.price * item.qty).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        {/* Summary footer */}
        <div style={{ background: 'white', borderTop: '1px solid #E8ECF4', padding: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 14, color: '#6B7A99' }}>Subtotal ({cartCount} items)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D' }}>KSh {subtotal.toLocaleString()}</div>
          </div>
          <button className="btn" onClick={() => setView('payment')} disabled={cart.length === 0} style={{
            width: '100%', padding: '16px',
            background: cart.length === 0 ? '#E8ECF4' : 'linear-gradient(135deg, #123A8F, #1A4FBF)',
            border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700,
            color: cart.length === 0 ? '#B0BAD3' : 'white', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: cart.length > 0 ? '0 4px 16px rgba(18,58,143,0.3)' : 'none'
          }}>
            Proceed to Payment →
          </button>
        </div>
      </div>
    )
  }

  // Main POS view
  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      {/* Search header */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              style={{
                width: '100%', padding: '11px 12px 11px 36px',
                background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 12, color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none'
              }} />
          </div>
          <button className="btn" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m9 22 v-11h6v11"/></svg>
          </button>
          <button className="btn" onClick={() => setView('cart')} style={{
            width: 44, height: 44, background: '#D4AF37', border: 'none',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', position: 'relative'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D1B3D" strokeWidth="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            {cartCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, background: '#D32F2F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{cartCount}</div>}
          </button>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(c => (
            <button key={c} className="btn" onClick={() => setCategory(c)} style={{
              padding: '6px 14px', borderRadius: 100, flexShrink: 0, border: 'none',
              background: category === c ? '#D4AF37' : 'rgba(255,255,255,0.12)',
              color: category === c ? '#0D1B3D' : 'rgba(255,255,255,0.8)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {filtered.map(p => {
            const inCart = cart.find(c => c.id === p.id)
            const lowStock = p.stock <= 5
            return (
              <button key={p.id} className="btn card" onClick={() => addToCart(p)} style={{
                padding: '12px 10px', cursor: 'pointer', border: 'none',
                position: 'relative', fontFamily: 'inherit', textAlign: 'left',
                outline: inCart ? '2px solid #123A8F' : 'none',
                outlineOffset: inCart ? '-2px' : '0'
              }}>
                {lowStock && <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#F9A825' }} />}
                {inCart && <div style={{ position: 'absolute', top: 6, left: 6 }}>
                  <span className="badge badge-blue" style={{ fontSize: 9 }}>×{inCart.qty}</span>
                </div>}
                <div style={{ fontSize: 28, marginBottom: 6, textAlign: 'center' }}>{p.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0D1B3D', lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#123A8F' }}>KSh {p.price}</div>
                <div style={{ fontSize: 10, color: lowStock ? '#F9A825' : '#6B7A99', marginTop: 2, fontWeight: lowStock ? 600 : 400 }}>{lowStock ? `Low: ${p.stock}` : `${p.stock} in stock`}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom cart summary */}
      {cart.length > 0 && (
        <div style={{ position: 'absolute', bottom: 68, left: 0, right: 0, padding: '0 12px 8px' }}>
          <button className="btn" onClick={() => setView('cart')} style={{
            width: '100%', padding: '14px 20px',
            background: 'linear-gradient(135deg, #123A8F, #1A4FBF)',
            border: 'none', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(18,58,143,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>{cartCount}</div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600 }}>View Cart</div>
            </div>
            <div style={{ color: '#D4AF37', fontSize: 16, fontWeight: 800 }}>KSh {subtotal.toLocaleString()}</div>
          </button>
        </div>
      )}
    </div>
  )
}
