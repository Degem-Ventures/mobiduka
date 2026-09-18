import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import WebSmartScan from './WebSmartScan'
import { apiFetch, getClientSession } from '../../lib/client-api'

type ProductItem = { id: string; name: string; price: number; category: string; stock: number; emoji: string; barcode?: string | null }
type CreditCustomer = { id: string; name: string; phone: string; balance: number }
type CartItem = Pick<ProductItem, 'id' | 'name' | 'price' | 'emoji'> & { qty: number }

interface Props {
  onNavigate: (screen: string) => void
}

export default function POSScreen({ onNavigate }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([])
  const [dataError, setDataError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'pos' | 'cart' | 'payment' | 'receipt'>('pos')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit'>('cash')
  const [discount, setDiscount] = useState(0)
  // Credit customer picker state
  const [selectedCreditor, setSelectedCreditor] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [creditSearch, setCreditSearch] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [isWebScannerOpen, setIsWebScannerOpen] = useState(false)
  const c = useColors()
  const session = getClientSession()
  const currentBusinessId = session?.user.businessId ?? ''
  const categories = ['All', ...new Set(products.map(product => product.category).filter(Boolean))]

  useEffect(() => {
    if (!session) {
      setDataError('Please sign in to load products and customers.')
      return
    }
    Promise.all([
      apiFetch<Array<{ id: string; name: string; barcode: string | null; sellingPrice: number | null; category: { name: string } | null; inventory: { quantity: number } | null }>>(`/api/products?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<Array<{ id: string; name: string; phone: string | null; creditAccount: { balance: number } | null }>>(`/api/customers?businessId=${encodeURIComponent(session.user.businessId)}`),
    ]).then(([productRows, customerRows]) => {
      setProducts(productRows.map(product => ({
        id: product.id,
        name: product.name,
        price: Number(product.sellingPrice ?? 0),
        category: product.category?.name ?? 'Uncategorized',
        stock: Number(product.inventory?.quantity ?? 0),
        emoji: '📦',
        barcode: product.barcode,
      })))
      setCreditCustomers(customerRows.map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone ?? 'No phone number',
        balance: Number(customer.creditAccount?.balance ?? 0),
      })))
    }).catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load POS data.'))
  }, [session?.user.businessId])

  const filtered = products.filter(p =>
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (p: typeof products[0]) => {
    setCart(prev => {
      const existing = prev.find(x => x.id === p.id)
      if (existing) return prev.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji }]
    })
  }

  const attachCustomerToSale = (customerId: string) => {
    const customer = creditCustomers.find(candidate => String(candidate.id) === customerId)
    if (!customer) return
    setSelectedCreditor({ id: customer.id, name: customer.name, phone: customer.phone })
    setPaymentMethod('credit')
    setView('payment')
  }

  const handleBarcodeProductLookup = (scannedCode: string) => {
    const product = products.find(candidate => candidate.barcode === scannedCode || String(candidate.id) === scannedCode || candidate.name.toLowerCase() === scannedCode.toLowerCase())
    setSearch(scannedCode)
    if (product) addToCart(product)
  }

  const addCustomer = async () => {
    if (!session || !quickName.trim() || !quickPhone.trim()) return
    try {
      const response = await apiFetch<{ customerId: string }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ businessId: session.user.businessId, name: quickName.trim(), phone: quickPhone.trim() }),
      })
      const customer = { id: response.customerId, name: quickName.trim(), phone: quickPhone.trim() }
      setCreditCustomers(previous => [...previous, { ...customer, balance: 0 }])
      setSelectedCreditor(customer)
      setShowQuickAdd(false)
      setQuickName('')
      setQuickPhone('')
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to add customer.')
    }
  }

  const handleWebScanSuccess = (scannedCode: string) => {
    setIsWebScannerOpen(false)
    if (scannedCode.startsWith('MOBIDUKA:USER:') || scannedCode.startsWith('CUST_')) {
      const customerId = scannedCode.replace('MOBIDUKA:USER:', '').replace('CUST_', '')
      attachCustomerToSale(customerId)
    } else {
      handleBarcodeProductLookup(scannedCode)
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(x => x.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x).filter(x => x.qty > 0))
  }

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const discountAmt = Math.round(subtotal * discount / 100)
  const total = subtotal - discountAmt
  const cartCount = cart.reduce((s, x) => s + x.qty, 0)

  if (view === 'receipt') {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 4 }}>MobiDuka Store · Nairobi CBD</div>
              <div style={{ fontSize: 12, color: c.faint }}>Tue 8 Jul 2026, 14:45</div>
            </div>
            <div style={{ borderTop: '1px dashed #E8ECF4', paddingTop: 16, marginBottom: 16 }}>
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: c.text }}>{item.name} × {item.qty}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>KSh {item.price * item.qty}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px dashed #E8ECF4', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: c.muted }}>Subtotal</div>
                <div style={{ fontSize: 13, color: c.text }}>KSh {subtotal}</div>
              </div>
              {discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: '#D32F2F' }}>Discount ({discount}%)</div>
                  <div style={{ fontSize: 13, color: '#D32F2F' }}>-KSh {discountAmt}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '2px solid #123A8F', marginTop: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>TOTAL</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#123A8F' }}>KSh {total.toLocaleString()}</div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: c.muted }}>Payment</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge ${paymentMethod === 'mpesa' ? 'badge-success' : paymentMethod === 'credit' ? 'badge-error' : 'badge-blue'}`}>
                    {paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'credit' ? 'Credit / Tab' : 'Cash'}
                  </span>
                </div>
              </div>
              {paymentMethod === 'credit' && selectedCreditor && (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: c.muted }}>Charged to</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#D32F2F' }}>{selectedCreditor.name}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={() => onNavigate('dashboard')} style={{
              padding: '14px 12px',
              background: 'rgba(13,27,61,0.08)', border: '1px solid #D0D7E8',
              borderRadius: 14, fontSize: 14, fontWeight: 600, color: c.muted,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            </button>
            <button className="btn" style={{
              flex: 1, padding: '14px',
              background: 'rgba(18,58,143,0.1)', border: '1px solid #123A8F',
              borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#123A8F',
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Print Receipt</button>
            <button className="btn" onClick={() => { setCart([]); setView('pos'); setDiscount(0); setSelectedCreditor(null); setCreditSearch('') }} style={{
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
      <div className="screen" style={{ background: c.bg }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: c.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Payment Method</div>
          {[
            { key: 'cash', label: 'Cash', sub: 'Physical cash payment', icon: '💵', color: '#123A8F' },
            { key: 'mpesa', label: 'M-Pesa', sub: 'Mobile money transfer', icon: '📱', color: '#2E7D32' },
            { key: 'credit', label: 'Credit / Tab', sub: 'Add to customer account', icon: '📋', color: '#D32F2F' },
          ].map(m => (
            <button key={m.key} className="btn" onClick={() => setPaymentMethod(m.key as 'cash' | 'mpesa' | 'credit')} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', marginBottom: 10, borderRadius: 14,
              background: paymentMethod === m.key ? `${m.color}12` : c.card,
              border: paymentMethod === m.key ? `2px solid ${m.color}` : '1.5px solid #E8ECF4',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: paymentMethod === m.key ? `0 0 0 4px ${m.color}10` : '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{m.icon}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{m.label}</div>
                <div style={{ fontSize: 12, color: c.muted }}>{m.sub}</div>
              </div>
              {paymentMethod === m.key && <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
              </div>}
            </button>
          ))}

          {/* Credit customer picker */}
          {paymentMethod === 'credit' && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer Account</div>

              {selectedCreditor ? (
                <div style={{ background: c.isDark ? 'rgba(18,58,143,0.25)' : 'rgba(18,58,143,0.08)', border: '2px solid #123A8F', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                    {selectedCreditor.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{selectedCreditor.name}</div>
                    <div style={{ fontSize: 12, color: c.muted }}>{selectedCreditor.phone}</div>
                  </div>
                  <button className="btn" onClick={() => setSelectedCreditor(null)} style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                </div>
              ) : (
                <div>
                  <input
                    className="input" placeholder="🔍 Search customer by name or phone…"
                    value={creditSearch}
                    onChange={e => { setCreditSearch(e.target.value); setShowQuickAdd(false) }}
                    style={{ marginBottom: 8 }}
                  />
                  <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 12, border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}` }}>
                    {creditCustomers
                      .filter(cu => cu.name.toLowerCase().includes(creditSearch.toLowerCase()) || cu.phone.includes(creditSearch))
                      .map((cu, i, arr) => (
                        <button key={cu.id} className="btn" onClick={() => { setSelectedCreditor({ id: cu.id, name: cu.name, phone: cu.phone }); setCreditSearch('') }} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', border: 'none',
                          borderBottom: i < arr.length - 1 ? c.divider : 'none',
                          background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {cu.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{cu.name}</div>
                            <div style={{ fontSize: 11, color: c.muted }}>{cu.phone}</div>
                          </div>
                          {cu.balance > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#D32F2F', background: c.errorBg, padding: '2px 8px', borderRadius: 100 }}>
                              Owes KSh {cu.balance.toLocaleString()}
                            </span>
                          )}
                        </button>
                      ))}
                    {creditCustomers.filter(cu => cu.name.toLowerCase().includes(creditSearch.toLowerCase()) || cu.phone.includes(creditSearch)).length === 0 && (
                      <div style={{ padding: '14px 16px', fontSize: 13, color: c.muted, textAlign: 'center' }}>No customers found</div>
                    )}
                  </div>
                  {/* Quick Add */}
                  {!showQuickAdd ? (
                    <button className="btn" onClick={() => setShowQuickAdd(true)} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'none', border: `1.5px dashed ${c.isDark ? '#1A3366' : '#D0D7E8'}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Quick-add new customer
                    </button>
                  ) : (
                    <div style={{ marginTop: 10, background: c.cardAlt, borderRadius: 12, padding: '14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10 }}>QUICK ADD</div>
                      <input className="input" placeholder="Full Name *" value={quickName} onChange={e => setQuickName(e.target.value)} style={{ marginBottom: 8 }} />
                      <input className="input" placeholder="Phone Number *" value={quickPhone} onChange={e => setQuickPhone(e.target.value)} type="tel" style={{ marginBottom: 10 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={() => { setShowQuickAdd(false); setQuickName(''); setQuickPhone('') }} style={{ flex: 1, padding: '10px', background: 'none', border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                        <button className="btn" onClick={() => void addCustomer()} disabled={!quickName || !quickPhone || !session} style={{ flex: 2, padding: '10px', background: quickName && quickPhone && session ? '#123A8F' : c.cardAlt, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: quickName && quickPhone && session ? 'white' : c.faint, cursor: quickName && quickPhone && session ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Add &amp; Select</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 5, 10, 15, 20].map(d => (
                <button key={d} className="btn" onClick={() => setDiscount(d)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 10,
                  background: discount === d ? '#123A8F' : c.card,
                  border: discount === d ? 'none' : '1.5px solid #E8ECF4',
                  color: discount === d ? 'white' : c.muted,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}>{d}%</button>
              ))}
            </div>
          </div>

          {(() => {
            const canComplete = paymentMethod !== 'credit' || !!selectedCreditor
            return (
              <button className="btn" onClick={() => { if (canComplete) setView('receipt') }} style={{
                width: '100%', marginTop: 28, padding: '18px',
                background: canComplete ? 'linear-gradient(135deg, #123A8F, #1A4FBF)' : (c.isDark ? '#162B5A' : '#E3EAF8'),
                border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 800,
                color: canComplete ? 'white' : c.muted,
                cursor: canComplete ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                boxShadow: canComplete ? '0 6px 24px rgba(18,58,143,0.4)' : 'none',
              }}>
                {paymentMethod === 'credit' && !selectedCreditor
                  ? 'Select a customer to proceed'
                  : `Complete Sale · KSh ${total.toLocaleString()}`}
              </button>
            )
          })()}
        </div>
      </div>
    )
  }

  if (view === 'cart') {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: c.faint }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: c.muted }}>Cart is empty</div>
            </div>
          ) : cart.map((item) => (
            <div key={item.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{item.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{item.name}</div>
                <div style={{ fontSize: 12, color: c.muted }}>KSh {item.price} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn" onClick={() => updateQty(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#F0F3F9', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <div style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: 700, color: c.text }}>{item.qty}</div>
                <button className="btn" onClick={() => updateQty(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#123A8F', border: 'none', cursor: 'pointer', fontSize: 16, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 700, color: c.text }}>
                KSh {(item.price * item.qty).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        {/* Summary footer */}
        <div style={{ background: c.card, borderTop: c.divider, padding: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 14, color: c.muted }}>Subtotal ({cartCount} items)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>KSh {subtotal.toLocaleString()}</div>
          </div>
          <button className="btn" onClick={() => setView('payment')} disabled={cart.length === 0} style={{
            width: '100%', padding: '16px',
            background: cart.length === 0 ? '#E8ECF4' : 'linear-gradient(135deg, #123A8F, #1A4FBF)',
            border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700,
            color: cart.length === 0 ? c.faint : 'white', cursor: 'pointer', fontFamily: 'inherit',
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
    <div className="screen" style={{ background: c.bg }}>
      {dataError && <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
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
          <button className="btn" type="button" onClick={() => setIsWebScannerOpen(true)} aria-label="Open webcam scanner" title="Open webcam scanner" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', fontSize: 19 }}>
            📷
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
          {categories.map(cat => (
            <button key={cat} className="btn" onClick={() => setCategory(cat)} style={{
              padding: '6px 14px', borderRadius: 100, flexShrink: 0, border: 'none',
              background: category === cat ? '#D4AF37' : 'rgba(255,255,255,0.12)',
              color: category === cat ? c.text : 'rgba(255,255,255,0.8)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {filtered.map(p => {
            const inCart = cart.find(x => x.id === p.id)
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
                <div style={{ fontSize: 11, fontWeight: 700, color: c.text, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#123A8F' }}>KSh {p.price}</div>
                <div style={{ fontSize: 10, color: lowStock ? '#F9A825' : c.muted, marginTop: 2, fontWeight: lowStock ? 600 : 400 }}>{lowStock ? `Low: ${p.stock}` : `${p.stock} in stock`}</div>
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

      {isWebScannerOpen && (
        <WebSmartScan
          businessId={currentBusinessId}
          onScanSuccess={handleWebScanSuccess}
          onClose={() => setIsWebScannerOpen(false)}
        />
      )}
    </div>
  )
}
