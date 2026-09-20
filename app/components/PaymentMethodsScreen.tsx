import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

interface Method {
  id: string; label: string; sub: string; icon: string; color: string
  enabled: boolean
}

interface Props { onNavigate: (s: string) => void }

type PaymentConfig = {
  methods: Record<string, boolean>
  mpesaConfig: { type: string; till: string; paybill: string; account: string }
  bankConfig: { name: string; account: string; branch: string }
  roundCash: boolean
  creditLimit: string
  requireApproval: boolean
}

type SettingsResponse = { preferences: { paymentConfig: PaymentConfig | null } }

export default function PaymentMethodsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [methods, setMethods] = useState<Method[]>([
    { id: 'cash',   label: 'Cash',          sub: 'Physical cash at counter',       icon: '💵', color: '#2E7D32', enabled: true  },
    { id: 'mpesa',  label: 'M-Pesa',         sub: 'Mobile money (Safaricom)',        icon: '📱', color: '#2E7D32', enabled: true  },
    { id: 'bank',   label: 'Bank Transfer',  sub: 'Direct bank / RTGS',             icon: '🏦', color: '#0288D1', enabled: false },
    { id: 'card',   label: 'Card (Visa/MC)', sub: 'POS terminal / tap-to-pay',      icon: '💳', color: '#7B1FA2', enabled: false },
    { id: 'credit', label: 'Credit / Tab',   sub: 'Defer payment to customer account', icon: '📋', color: '#D32F2F', enabled: true  },
  ])

  // M-Pesa config
  const [mpesaConfig, setMpesaConfig] = useState({ type: 'till', till: '123456', paybill: '', account: '' })
  const [showMpesaConfig, setShowMpesaConfig] = useState(false)

  // Bank config
  const [bankConfig, setBankConfig] = useState({ name: '', account: '', branch: '' })
  const [showBankConfig, setShowBankConfig] = useState(false)

  // Cash options
  const [roundCash, setRoundCash] = useState(false)
  const [showCashConfig, setShowCashConfig] = useState(false)

  // Credit options
  const [creditLimit, setCreditLimit] = useState('5000')
  const [requireApproval, setRequireApproval] = useState(true)
  const [showCreditConfig, setShowCreditConfig] = useState(false)

  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const paymentConfig = (): PaymentConfig => ({
    methods: Object.fromEntries(methods.map(method => [method.id, method.enabled])),
    mpesaConfig,
    bankConfig,
    roundCash,
    creditLimit,
    requireApproval,
  })

  const applyPaymentConfig = (config: PaymentConfig) => {
    if (config.methods) setMethods(current => current.map(method => ({ ...method, enabled: config.methods[method.id] ?? method.enabled })))
    if (config.mpesaConfig) setMpesaConfig(config.mpesaConfig)
    if (config.bankConfig) setBankConfig(config.bankConfig)
    if (config.roundCash !== undefined) setRoundCash(config.roundCash)
    if (config.creditLimit !== undefined) setCreditLimit(config.creditLimit)
    if (config.requireApproval !== undefined) setRequireApproval(config.requireApproval)
  }

  useEffect(() => {
    const session = getClientSession()
    if (!session) return
    apiFetch<SettingsResponse>(`/api/settings?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(response => { if (response.preferences.paymentConfig) applyPaymentConfig(response.preferences.paymentConfig) })
      .catch(reason => setSaveError(reason instanceof Error ? reason.message : 'Unable to load payment settings.'))
  }, [])

  const toggle = (id: string) => {
    setMethods(ms => ms.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  const handleSave = async () => {
    const session = getClientSession()
    if (!session) return
    try {
      const response = await apiFetch<SettingsResponse>('/api/settings', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, paymentConfig: paymentConfig() }) })
      if (response.preferences.paymentConfig) applyPaymentConfig(response.preferences.paymentConfig)
      setSaveError('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'Unable to save payment settings.') }
  }

  const enabledCount = methods.filter(m => m.enabled).length

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Payment Methods</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{enabledCount} of {methods.length} active</div>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
        {saved && (
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Payment settings saved</span>
          </div>
        )}
        {saveError && <div style={{ background: c.errorBg, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#D32F2F' }}>{saveError}</div>}

        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Accepted Payment Methods</div>

        {/* Method toggles */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {methods.map((m, i, arr) => (
            <div key={m.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < arr.length - 1 || (m.enabled && (m.id === 'mpesa' || m.id === 'bank' || m.id === 'cash' || m.id === 'credit')) ? c.divider : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(m.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{m.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {m.enabled && (m.id === 'mpesa' || m.id === 'bank' || m.id === 'cash' || m.id === 'credit') && (
                    <button className="btn" onClick={() => {
                      if (m.id === 'mpesa') setShowMpesaConfig(v => !v)
                      if (m.id === 'bank') setShowBankConfig(v => !v)
                      if (m.id === 'cash') setShowCashConfig(v => !v)
                      if (m.id === 'credit') setShowCreditConfig(v => !v)
                    }} style={{ background: 'none', border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Configure
                    </button>
                  )}
                  <button className="btn" onClick={() => toggle(m.id)} style={{
                    width: 48, height: 27, borderRadius: 14, flexShrink: 0,
                    background: m.enabled ? m.color : (c.isDark ? '#1A3366' : '#D0D7E8'),
                    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 3,
                      left: m.enabled ? 24 : 3,
                      width: 21, height: 21, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    }} />
                  </button>
                </div>
              </div>

              {/* Inline config panels */}
              {m.id === 'mpesa' && m.enabled && showMpesaConfig && (
                <div style={{ background: c.cardAlt, padding: '16px', borderBottom: c.divider }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10 }}>M-PESA CONFIGURATION</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {['till', 'paybill'].map(t => (
                      <button key={t} className="btn" onClick={() => setMpesaConfig(p => ({ ...p, type: t }))} style={{ flex: 1, padding: '9px', borderRadius: 10, border: mpesaConfig.type === t ? '2px solid #2E7D32' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, background: mpesaConfig.type === t ? (c.isDark ? 'rgba(46,125,50,0.2)' : 'rgba(46,125,50,0.08)') : c.card, color: mpesaConfig.type === t ? '#2E7D32' : c.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{t}</button>
                    ))}
                  </div>
                  {mpesaConfig.type === 'till' ? (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Till Number</label>
                      <input className="input" placeholder="e.g. 123456" value={mpesaConfig.till} onChange={e => setMpesaConfig(p => ({ ...p, till: e.target.value }))} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Paybill No.</label>
                        <input className="input" placeholder="e.g. 400200" value={mpesaConfig.paybill} onChange={e => setMpesaConfig(p => ({ ...p, paybill: e.target.value }))} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Account No.</label>
                        <input className="input" placeholder="Account" value={mpesaConfig.account} onChange={e => setMpesaConfig(p => ({ ...p, account: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {m.id === 'bank' && m.enabled && showBankConfig && (
                <div style={{ background: c.cardAlt, padding: '16px', borderBottom: c.divider }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10 }}>BANK ACCOUNT DETAILS</div>
                  {[
                    { label: 'Bank Name', key: 'name', placeholder: 'e.g. Equity Bank' },
                    { label: 'Account Number', key: 'account', placeholder: '0123456789' },
                    { label: 'Branch', key: 'branch', placeholder: 'e.g. Nairobi CBD' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
                      <input className="input" placeholder={f.placeholder} value={bankConfig[f.key as keyof typeof bankConfig]} onChange={e => setBankConfig(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}

              {m.id === 'cash' && m.enabled && showCashConfig && (
                <div style={{ background: c.cardAlt, padding: '16px', borderBottom: c.divider }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Round to nearest KSh 5</div>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Helps cashiers avoid giving small change</div>
                    </div>
                    <button className="btn" onClick={() => setRoundCash(v => !v)} style={{ width: 48, height: 27, borderRadius: 14, background: roundCash ? '#2E7D32' : (c.isDark ? '#1A3366' : '#D0D7E8'), border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: roundCash ? 24 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                    </button>
                  </div>
                </div>
              )}

              {m.id === 'credit' && m.enabled && showCreditConfig && (
                <div style={{ background: c.cardAlt, padding: '16px', borderBottom: i < arr.length - 1 ? c.divider : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 12 }}>CREDIT / TAB SETTINGS</div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Default Credit Limit (KSh)</label>
                    <input className="input" type="number" placeholder="5000" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Require manager approval</div>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>For credit sales above the limit</div>
                    </div>
                    <button className="btn" onClick={() => setRequireApproval(v => !v)} style={{ width: 48, height: 27, borderRadius: 14, background: requireApproval ? '#D32F2F' : (c.isDark ? '#1A3366' : '#D0D7E8'), border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: requireApproval ? 24 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div style={{ background: c.infoBg, border: `1px solid ${c.isDark ? 'rgba(18,58,143,0.4)' : '#BBDEFB'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#90CAF9' : '#1565C0', marginBottom: 4 }}>ℹ️ Admin note</div>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.5 }}>Disabled payment methods will be hidden from cashiers during checkout. Changes take effect immediately.</div>
        </div>

        <button className="btn" onClick={handleSave} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
          Save Payment Settings
        </button>
      </div>
    </div>
  )
}
