import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

interface Props { onNavigate: (s: string) => void }

const formats = [
  { id: '80mm',  label: '80mm Thermal', sub: 'Standard receipt printer' },
  { id: '58mm',  label: '58mm Thermal', sub: 'Compact/mobile printer' },
  { id: 'a4',    label: 'A4 Paper',     sub: 'Desktop / home printer' },
  { id: 'sms',   label: 'SMS / WhatsApp', sub: 'Send receipt to phone' },
]

type ReceiptConfig = { headerText: string; footerText: string; format: string; showLogo: boolean; showTax: boolean; showDiscount: boolean; showCashier: boolean; showShift: boolean; showBarcode: boolean; receiptPrefix: string; nextNumber: string }
type SettingsResponse = { preferences: { receiptConfig: ReceiptConfig | null } }
type BusinessResponse = { business: { name: string; branch: string | null; country: string | null; phone: string | null; email: string | null } }

const defaultReceiptConfig: ReceiptConfig = {
  headerText: 'Thank you for shopping with us!', footerText: 'Goods sold are not refundable · Valid receipt required for exchange', format: '80mm', showLogo: true, showTax: true, showDiscount: true, showCashier: true, showShift: true, showBarcode: false, receiptPrefix: 'RCP', nextNumber: '1042',
}

export default function ReceiptSettingsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [form, setForm] = useState<ReceiptConfig>(defaultReceiptConfig)
  const [business, setBusiness] = useState({ name: '', branch: '', country: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)

  const set = <K extends keyof ReceiptConfig>(k: K, v: ReceiptConfig[K]) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setError('Please sign in to load receipt settings.'); setLoading(false); return }
    void Promise.allSettled([
      apiFetch<BusinessResponse>(`/api/business?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<SettingsResponse>(`/api/settings?businessId=${encodeURIComponent(session.user.businessId)}&includeReceiptConfig=true`),
    ]).then(([profileResult, settingsResult]) => {
      if (profileResult.status === 'fulfilled') {
        const loadedBusiness = profileResult.value.business
        setBusiness({ name: loadedBusiness.name, branch: loadedBusiness.branch ?? '', country: loadedBusiness.country ?? '', phone: loadedBusiness.phone ?? '', email: loadedBusiness.email ?? '' })
      }
      if (settingsResult.status === 'fulfilled' && settingsResult.value.preferences.receiptConfig) setForm(settingsResult.value.preferences.receiptConfig)
      if (profileResult.status === 'rejected') setError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Unable to load business information.')
      else if (settingsResult.status === 'rejected') setError('Receipt preferences could not be loaded; defaults are ready to use.')
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const session = getClientSession()
    if (!session) return
    setSaving(true); setError('')
    try {
      await Promise.all([
        apiFetch('/api/business', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, name: business.name, branch: business.branch, phone: business.phone, email: business.email }) }),
        apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, receiptConfig: form }) }),
      ])
      setSaved(true); window.setTimeout(() => setSaved(false), 2000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save receipt settings.') }
    finally { setSaving(false) }
  }

  const Toggle = ({ label, sub, field }: { label: string; sub?: string; field: 'showLogo' | 'showTax' | 'showDiscount' | 'showCashier' | 'showShift' | 'showBarcode' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: c.divider }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <button className="btn" onClick={() => set(field, !form[field])} style={{
        width: 48, height: 27, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: form[field] ? '#123A8F' : (c.isDark ? '#1A3366' : '#D0D7E8'),
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', top: 3, left: form[field] ? 24 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
      </button>
    </div>
  )

  if (preview) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setPreview(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Receipt Preview</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 24px 80px', display: 'flex', justifyContent: 'center' }}>
          {/* Mock receipt */}
          <div style={{ width: '100%', maxWidth: 280, background: 'white', borderRadius: 4, padding: '20px 16px', fontFamily: 'monospace', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', color: '#111' }}>
            {form.showLogo && <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>MobiDuka</div>
            </div>}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{business.name || 'Your business'}</div>
              {[business.branch, business.country].filter(Boolean).join(', ') && <div style={{ fontSize: 11 }}>{[business.branch, business.country].filter(Boolean).join(', ')}</div>}
              {business.phone && <div style={{ fontSize: 11 }}>{business.phone}</div>}
              {form.headerText && <div style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>{form.headerText}</div>}
            </div>
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            <div style={{ fontSize: 11, marginBottom: 4 }}>Receipt #: {form.receiptPrefix}-{form.nextNumber}</div>
            <div style={{ fontSize: 11, marginBottom: 8 }}>Date: {new Date().toLocaleDateString('en-GB')}</div>
            {form.showCashier && <div style={{ fontSize: 11, marginBottom: 4 }}>Cashier: Grace W.</div>}
            {form.showShift && <div style={{ fontSize: 11, marginBottom: 8 }}>Shift: Morning</div>}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            {[['Unga Jogoo 2kg ×2', 'KSh 400'], ['Cooking Oil 1L', 'KSh 190']].map(([item, price]) => (
              <div key={item} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span>{item}</span><span>{price}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>Subtotal</span><span>KSh 590</span></div>
            {form.showDiscount && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>Discount (5%)</span><span>-KSh 30</span></div>}
            {form.showTax && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>VAT (16%)</span><span>KSh 89</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, borderTop: '2px solid #111', paddingTop: 6, marginTop: 4 }}><span>TOTAL</span><span>KSh 649</span></div>
            {form.footerText && <div style={{ textAlign: 'center', fontSize: 10, marginTop: 12, lineHeight: 1.6, color: '#555' }}>{form.footerText}</div>}
            {form.showBarcode && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 20, letterSpacing: 3 }}>|||||||||||||||||||||</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Receipt Settings</div>
          </div>
          <button className="btn" onClick={() => setPreview(true)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Preview
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
        {loading && <div style={{ color: c.muted, fontSize: 13, padding: '12px 4px' }}>Loading receipt settings…</div>}
        {error && <div style={{ background: c.errorBg, color: '#C62828', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12 }}>{error}</div>}
        {saved && (
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>✅</span><span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Receipt settings saved</span>
          </div>
        )}

        {/* Store Info */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Store Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[
            { label: 'Store Name', key: 'name', placeholder: 'Your business name' },
            { label: 'Branch / Address', key: 'branch', placeholder: 'Street, area, city' },
            { label: 'Phone', key: 'phone', placeholder: '07XX XXX XXX', type: 'tel' },
            { label: 'Email', key: 'email', placeholder: 'store@email.com', type: 'email' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input className="input" type={f.type || 'text'} placeholder={f.placeholder} value={business[f.key as 'name' | 'branch' | 'phone' | 'email']} onChange={event => setBusiness(value => ({ ...value, [f.key]: event.target.value }))} />
            </div>
          ))}
          <div style={{ fontSize: 11, color: c.muted, marginTop: -3 }}>These details are saved to your business profile and printed automatically on receipts.</div>
        </div>

        {/* Header / Footer */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Header & Footer</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Header Message</label>
            <input className="input" placeholder="Shown above items" value={form.headerText} onChange={e => set('headerText', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Footer Message</label>
            <input className="input" placeholder="Return/refund policy etc." value={form.footerText} onChange={e => set('footerText', e.target.value)} />
          </div>
        </div>

        {/* Print Format */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Print Format</div>
        <div className="card" style={{ padding: '12px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {formats.map(f => (
              <button key={f.id} className="btn" onClick={() => set('format', f.id)} style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: form.format === f.id ? (c.isDark ? 'rgba(18,58,143,0.35)' : 'rgba(18,58,143,0.08)') : c.cardAlt,
                border: form.format === f.id ? '2px solid #123A8F' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{f.label}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{f.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Receipt number */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Receipt Numbering</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Prefix</label>
              <input className="input" placeholder="RCP" value={form.receiptPrefix} onChange={e => set('receiptPrefix', e.target.value.toUpperCase())} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Next Number</label>
              <input className="input" type="number" value={form.nextNumber} onChange={e => set('nextNumber', e.target.value)} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: c.muted }}>
            Next receipt: <span style={{ fontWeight: 700, color: c.text, fontFamily: 'monospace' }}>{form.receiptPrefix}-{form.nextNumber}</span>
          </div>
        </div>

        {/* Show/hide sections */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Show on Receipt</div>
        <div className="card" style={{ padding: '4px 16px 4px', marginBottom: 20 }}>
          <Toggle label="Store Logo" sub="Display brand logo at top" field="showLogo" />
          <Toggle label="Tax / VAT Line" sub="Show VAT amount on receipt" field="showTax" />
          <Toggle label="Discount Line" sub="Show any discount applied" field="showDiscount" />
          <Toggle label="Cashier Name" sub="Who processed the sale" field="showCashier" />
          <Toggle label="Shift Name" sub="Which shift the sale was made" field="showShift" />
          <Toggle label="Barcode" sub="Receipt number as barcode" field="showBarcode" />
        </div>

        <button className="btn" disabled={loading || saving} onClick={() => void handleSave()} style={{ width: '100%', padding: '16px', background: loading || saving ? c.cardAlt : 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: loading || saving ? c.faint : 'white', cursor: loading || saving ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: loading || saving ? 'none' : '0 4px 16px rgba(18,58,143,0.35)' }}>
          {saving ? 'Saving…' : 'Save Receipt Settings'}
        </button>
      </div>
    </div>
  )
}
