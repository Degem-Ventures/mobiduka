import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'
import { useAutoDismissMessage } from '../../lib/use-auto-dismiss-message'

interface Props { onNavigate: (s: string) => void }

const taxCategories = [
  { id: 'standard', label: 'Standard Rate',  rate: 16, desc: 'General goods & services' },
  { id: 'reduced',  label: 'Reduced Rate',   rate: 8,  desc: 'Specific food items, LPG' },
  { id: 'zero',     label: 'Zero Rated',     rate: 0,  desc: 'Maize flour, bread, rice, milk' },
  { id: 'exempt',   label: 'Exempt',         rate: 0,  desc: 'Financial services, insurance' },
]

const filingPeriods = ['Monthly', 'Quarterly', 'Annual']
type TaxRate = 'standard' | 'reduced' | 'zero' | 'exempt'
type FilingPeriod = 'Monthly' | 'Quarterly' | 'Annual'
type TaxConfig = { vatEnabled: boolean; defaultRate: TaxRate; filingPeriod: FilingPeriod; etimsEnabled: boolean; etimsDevice: string }
type SettingsResponse = { preferences: { taxConfig: TaxConfig | null } }
type BusinessResponse = { business: { kraPin: string | null } }
const defaultTaxConfig: TaxConfig = { vatEnabled: true, defaultRate: 'standard', filingPeriod: 'Monthly', etimsEnabled: false, etimsDevice: '' }

export default function TaxComplianceScreen({ onNavigate }: Props) {
  const c = useColors()
  const [vatPin, setVatPin] = useState('')
  const [editingPin, setEditingPin] = useState(false)
  const [pinDraft, setPinDraft] = useState(vatPin)
  const [pinError, setPinError] = useAutoDismissMessage()
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(defaultTaxConfig)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useAutoDismissMessage()

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setError('Please sign in to load tax settings.'); setLoading(false); return }
    void Promise.all([
      apiFetch<BusinessResponse>(`/api/business?businessId=${encodeURIComponent(session.user.businessId)}`),
      apiFetch<SettingsResponse>(`/api/settings?businessId=${encodeURIComponent(session.user.businessId)}&includeTaxConfig=true`),
    ]).then(([businessData, settingsData]) => {
        const pin = businessData.business.kraPin ?? ''
        setVatPin(pin); setPinDraft(pin)
        if (settingsData.preferences.taxConfig) setTaxConfig(settingsData.preferences.taxConfig)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Tax preferences could not be loaded; defaults are ready to use.'))
      .finally(() => setLoading(false))
  }, [])

  const savePin = () => {
    if (pinDraft.trim().length < 10) { setPinError('KRA PIN must be at least 10 characters'); return }
    setPinError('')
    setVatPin(pinDraft.toUpperCase().trim())
    setEditingPin(false)
  }

  const handleSave = async () => {
    const session = getClientSession()
    if (!session) return
    setSaving(true); setError('')
    try {
      await Promise.all([
        apiFetch('/api/business', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, taxPin: vatPin || null }) }),
        apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, taxConfig }) }),
      ])
      setSaved(true); window.setTimeout(() => setSaved(false), 2000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save tax settings.') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Tax & Compliance</div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
        {error && <div style={{ background: c.tint('#D32F2F'), border: '1px solid rgba(211,47,47,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#D32F2F' }}>{error}</div>}
        {saved && (
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>✅</span><span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Tax settings saved</span>
          </div>
        )}

        {/* KRA PIN */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>KRA / VAT PIN</div>
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          {editingPin ? (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>KRA PIN</label>
              <input
                className="input"
                value={pinDraft}
                onChange={e => { setPinDraft(e.target.value.toUpperCase()); setPinError('') }}
                placeholder="e.g. A123456789B"
                style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, marginBottom: pinError ? 8 : 12 }}
                autoFocus
              />
              {pinError && <div style={{ fontSize: 12, color: '#D32F2F', marginBottom: 10 }}>⚠️ {pinError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { setEditingPin(false); setPinDraft(vatPin); setPinError('') }} style={{ flex: 1, padding: '10px', background: 'none', border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button className="btn" onClick={savePin} style={{ flex: 2, padding: '10px', background: '#123A8F', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Save PIN</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>KRA PIN</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: c.text, fontFamily: 'monospace', letterSpacing: 2 }}>{vatPin}</div>
              </div>
              <button className="btn" onClick={() => { setEditingPin(true); setPinDraft(vatPin) }} style={{ background: c.iconBg, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            </div>
          )}
        </div>

        {/* VAT settings */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>VAT Settings</div>
        <div className="card" style={{ padding: '4px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: c.divider }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Enable VAT</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Apply VAT to applicable sales</div>
            </div>
            <button className="btn" onClick={() => setTaxConfig(config => ({ ...config, vatEnabled: !config.vatEnabled }))} style={{ width: 48, height: 27, borderRadius: 14, border: 'none', cursor: 'pointer', background: taxConfig.vatEnabled ? '#123A8F' : (c.isDark ? '#1A3366' : '#D0D7E8'), position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: taxConfig.vatEnabled ? 24 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
            </button>
          </div>
          <div style={{ padding: '13px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 10 }}>Default Tax Rate</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {taxCategories.map(tc => (
                <button key={tc.id} className="btn" onClick={() => setTaxConfig(config => ({ ...config, defaultRate: tc.id as TaxRate }))} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: 'none',
                  background: taxConfig.defaultRate === tc.id ? (c.isDark ? 'rgba(18,58,143,0.25)' : 'rgba(18,58,143,0.07)') : c.cardAlt,
                  outline: taxConfig.defaultRate === tc.id ? '2px solid #123A8F' : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.rate > 8 ? c.tint('#D32F2F') : tc.rate > 0 ? c.tint('#F57C00') : c.tint('#2E7D32'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: tc.rate > 8 ? '#D32F2F' : tc.rate > 0 ? '#F57C00' : '#2E7D32', flexShrink: 0 }}>
                    {tc.rate}%
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{tc.label}</div>
                    <div style={{ fontSize: 11, color: c.muted }}>{tc.desc}</div>
                  </div>
                  {taxConfig.defaultRate === tc.id && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filing */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Filing Period</div>
        <div className="card" style={{ padding: '12px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {filingPeriods.map(p => (
              <button key={p} className="btn" onClick={() => setTaxConfig(config => ({ ...config, filingPeriod: p as FilingPeriod }))} style={{ flex: 1, padding: '11px 6px', borderRadius: 10, border: taxConfig.filingPeriod === p ? '2px solid #123A8F' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, background: taxConfig.filingPeriod === p ? (c.isDark ? 'rgba(18,58,143,0.25)' : 'rgba(18,58,143,0.08)') : c.card, color: taxConfig.filingPeriod === p ? '#123A8F' : c.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
            ))}
          </div>
        </div>

        {/* eTIMS */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>eTIMS Integration</div>
        <div className="card" style={{ padding: '4px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: taxConfig.etimsEnabled ? c.divider : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Enable eTIMS</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>KRA electronic tax invoice system</div>
            </div>
            <button className="btn" onClick={() => setTaxConfig(config => ({ ...config, etimsEnabled: !config.etimsEnabled }))} style={{ width: 48, height: 27, borderRadius: 14, border: 'none', cursor: 'pointer', background: taxConfig.etimsEnabled ? '#123A8F' : (c.isDark ? '#1A3366' : '#D0D7E8'), position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: taxConfig.etimsEnabled ? 24 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
            </button>
          </div>
          {taxConfig.etimsEnabled && (
            <div style={{ padding: '13px 0' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Device Serial Number</label>
              <input className="input" placeholder="e.g. KRA-ETIMS-0001234" value={taxConfig.etimsDevice} onChange={e => setTaxConfig(config => ({ ...config, etimsDevice: e.target.value }))} style={{ fontFamily: 'monospace' }} />
            </div>
          )}
        </div>

        <button className="btn" onClick={handleSave} disabled={loading || saving} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: loading || saving ? 'wait' : 'pointer', opacity: loading || saving ? 0.7 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
          {saving ? 'Saving…' : 'Save Tax Settings'}
        </button>
      </div>
    </div>
  )
}
