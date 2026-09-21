import { useEffect, useState } from 'react'
import { useTheme, ThemeMode } from '../context/ThemeContext'
import { formatPhoneForDisplay } from '../utils/format-phone'
import { apiFetch, getClientSession } from '../../lib/client-api'

interface Props {
  onNavigate: (s: string) => void
}

const CURRENCIES = [
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
]

type SettingsResponse = {
  business: { name: string; branch: string | null; country: string | null; phone: string | null; taxPin: string | null; currency: string }
  preferences: { receiptPrint: boolean; lowStockAlerts: boolean; salesNotifications: boolean; dailyReport: boolean; autoBackup: boolean; mpesaEnabled: boolean; themeMode: ThemeMode; paymentConfig: unknown }
  currencyOptions: Array<{ code: string; label: string }>
}

export default function SettingsScreen({ onNavigate }: Props) {
  const { theme, setTheme, isDark } = useTheme()

  const [receiptPrint, setReceiptPrint] = useState(true)
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [salesNotifications, setSalesNotifications] = useState(true)
  const [dailyReport, setDailyReport] = useState(false)
  const [autoBackup, setAutoBackup] = useState(true)
  const [mpesaEnabled, setMpesaEnabled] = useState(true)

  const [currency, setCurrency] = useState('KES')
  const [taxPin, setTaxPin] = useState('')
  const [editingTaxPin, setEditingTaxPin] = useState(false)
  const [taxPinDraft, setTaxPinDraft] = useState('')
  const [businessInfo, setBusinessInfo] = useState({ name: 'Business', branch: '', country: '', phone: '' })
  const [currencyOptions, setCurrencyOptions] = useState(CURRENCIES)
  const [settingsError, setSettingsError] = useState('')
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

  const [simState, setSimState] = useState<Record<string, 'idle' | 'loading' | 'done'>>({
    backup: 'idle', export: 'idle', cache: 'idle',
  })

  const runSim = (key: string) => {
    setSimState(s => ({ ...s, [key]: 'loading' }))
    setTimeout(() => setSimState(s => ({ ...s, [key]: 'done' })), 2200)
    setTimeout(() => setSimState(s => ({ ...s, [key]: 'idle' })), 4500)
  }

  const applySettings = (response: SettingsResponse) => {
    setBusinessInfo({ name: response.business.name, branch: response.business.branch ?? '', country: response.business.country ?? '', phone: response.business.phone ?? '' })
    setTaxPin(response.business.taxPin ?? '')
    setTaxPinDraft(response.business.taxPin ?? '')
    setCurrency(response.business.currency)
    setCurrencyOptions(response.currencyOptions)
    setReceiptPrint(response.preferences.receiptPrint)
    setLowStockAlerts(response.preferences.lowStockAlerts)
    setSalesNotifications(response.preferences.salesNotifications)
    setDailyReport(response.preferences.dailyReport)
    setAutoBackup(response.preferences.autoBackup)
    setMpesaEnabled(response.preferences.mpesaEnabled)
    setTheme(response.preferences.themeMode)
  }

  const saveSettings = async (patch: Partial<SettingsResponse['business'] & SettingsResponse['preferences']>) => {
    const session = getClientSession()
    if (!session) return
    try {
      const response = await apiFetch<SettingsResponse>('/api/settings', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, ...patch }) })
      applySettings(response)
      setSettingsError('')
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : 'Unable to save settings.')
    }
  }

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setSettingsError('Please sign in to load settings.'); return }
    apiFetch<SettingsResponse>(`/api/settings?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(applySettings)
      .catch(reason => setSettingsError(reason instanceof Error ? reason.message : 'Unable to load settings.'))
  }, [])

  const card = isDark ? '#0F2040' : '#FFFFFF'
  const bg = isDark ? '#09152A' : '#F5F7FA'
  const text = isDark ? '#DCE6FF' : '#0D1B3D'
  const muted = isDark ? '#7A8FBF' : '#6B7A99'
  const border = isDark ? '1px solid #1A3366' : '1px solid #F0F3F9'

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button className="btn" onClick={() => onChange(!value)} style={{
      width: 46, height: 26, borderRadius: 13,
      background: value ? '#123A8F' : isDark ? '#1A3366' : '#D0D7E8',
      border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  )

  const SectionLabel = ({ children }: { children: string }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{children}</div>
  )

  const selectedCurrencyLabel = currencyOptions.find(c => c.code === currency)?.label ?? currency

  if (showCurrencyPicker) {
    return (
      <div className="screen" style={{ background: bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowCurrencyPicker(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Select Currency</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div className="card" style={{ overflow: 'hidden', background: card }}>
            {currencyOptions.map((c, i) => (
              <button key={c.code} className="btn" onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false); void saveSettings({ currency: c.code }) }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14, border: 'none', borderBottom: i < currencyOptions.length - 1 ? border : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.label}</div>
                </div>
                {currency === c.code && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#123A8F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Settings</div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {settingsError && <div style={{ background: isDark ? '#3A1F2A' : '#FFF5F5', color: '#D32F2F', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{settingsError}</div>}

        {/* ── Appearance ── */}
        <SectionLabel>Appearance</SectionLabel>
        <div className="card" style={{ padding: '16px', marginBottom: 16, background: card }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 12 }}>Theme</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['light', 'dark', 'auto'] as ThemeMode[]).map(t => {
              const labels = { light: '☀️ Light', dark: '🌙 Dark', auto: '⚙️ Auto' }
              const active = theme === t
              return (
                <button key={t} className="btn" onClick={() => { setTheme(t); void saveSettings({ themeMode: t }) }} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 12, border: active ? '2px solid #123A8F' : `1.5px solid ${isDark ? '#1A3366' : '#E8ECF4'}`,
                  background: active ? (isDark ? 'rgba(18,58,143,0.25)' : 'rgba(18,58,143,0.08)') : (isDark ? '#0D1B3D' : 'white'),
                  fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#123A8F' : muted,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                }}>{labels[t]}</button>
              )
            })}
          </div>
        </div>

        {/* ── Business Info ── */}
        <SectionLabel>Business Information</SectionLabel>
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden', background: card }}>
          {[
            { label: 'Business Name', value: businessInfo.name },
            { label: 'Location', value: [businessInfo.branch, businessInfo.country].filter(Boolean).join(', ') || '—' },
            { label: 'Phone', value: businessInfo.phone ? formatPhoneForDisplay(businessInfo.phone) : '—' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: border }}>
              <div style={{ fontSize: 13, color: muted }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{item.value}</div>
            </div>
          ))}
          {/* Tax PIN — editable */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: border, gap: 10 }}>
            <div style={{ fontSize: 13, color: muted, flex: 1 }}>Tax PIN</div>
            {editingTaxPin ? (
              <>
                <input className="input" value={taxPinDraft} onChange={e => setTaxPinDraft(e.target.value.toUpperCase())} style={{ width: 140, padding: '6px 10px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }} />
                <button className="btn" onClick={() => { setTaxPin(taxPinDraft); setEditingTaxPin(false); void saveSettings({ taxPin: taxPinDraft }) }} style={{ background: '#123A8F', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: text, fontFamily: 'monospace' }}>{taxPin}</div>
                <button className="btn" onClick={() => { setTaxPinDraft(taxPin); setEditingTaxPin(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </>
            )}
          </div>
          {/* Currency — picker */}
          <button className="btn" onClick={() => setShowCurrencyPicker(true)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ fontSize: 13, color: muted }}>Currency</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#123A8F' }}>{selectedCurrencyLabel}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </button>
        </div>

        {/* ── Preferences ── */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden', background: card }}>
          {[
            { label: 'Auto-print Receipt', sub: 'Print receipt after every sale', value: receiptPrint, onChange: (value: boolean) => { setReceiptPrint(value); void saveSettings({ receiptPrint: value }) } },
            { label: 'Low Stock Alerts', sub: 'Notify when stock is below reorder level', value: lowStockAlerts, onChange: (value: boolean) => { setLowStockAlerts(value); void saveSettings({ lowStockAlerts: value }) } },
            { label: 'Sales Completed Alerts', sub: 'Notify after each completed sale', value: salesNotifications, onChange: (value: boolean) => { setSalesNotifications(value); void saveSettings({ salesNotifications: value }) } },
            { label: 'Daily Report Email', sub: 'Send end-of-day report to email', value: dailyReport, onChange: (value: boolean) => { setDailyReport(value); void saveSettings({ dailyReport: value }) } },
            { label: 'Auto Cloud Backup', sub: 'Backup data daily at midnight', value: autoBackup, onChange: (value: boolean) => { setAutoBackup(value); void saveSettings({ autoBackup: value }) } },
            { label: 'M-Pesa Integration', sub: 'Accept M-Pesa payments', value: mpesaEnabled, onChange: (value: boolean) => { setMpesaEnabled(value); void saveSettings({ mpesaEnabled: value }) } },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? border : 'none', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{item.sub}</div>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>

        {/* ── Payment Methods ── */}
        <SectionLabel>Admin Area</SectionLabel>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16, background: card }}>
          {([
            { icon: '💳', label: 'Payment Methods', sub: 'Cash · M-Pesa · Bank · Credit', nav: 'payments', color: '#0288D1' },
            { icon: '🧾', label: 'Receipt Settings', sub: 'Logo, footer text, print format', nav: '', color: '#5E35B1' },
            { icon: '📊', label: 'Tax & Compliance', sub: `PIN: ${taxPin}`, nav: '', color: '#2E7D32' },
          ] as { icon: string; label: string; sub: string; nav: string; color: string }[]).map((item, i, arr) => (
            <button key={i} className="btn" onClick={() => item.nav ? onNavigate(item.nav) : undefined} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? border : 'none', background: 'none', cursor: item.nav ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{item.sub}</div>
              </div>
              {item.nav && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>}
            </button>
          ))}
        </div>

        {/* ── Security ── */}
        <SectionLabel>Security</SectionLabel>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16, background: card }}>
          {[
            { label: 'Active Sessions', sub: '1 device logged in', icon: '📱', color: '#123A8F', nav: 'sessions' },
            { label: 'Two-Factor Auth', sub: 'Not enabled', icon: '🛡️', color: '#2E7D32', nav: 'twofa' },
          ].map((item, i, arr) => (
            <button key={i} className="btn" onClick={() => onNavigate(item.nav)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? border : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* ── Data Management ── */}
        <SectionLabel>Data Management</SectionLabel>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16, background: card }}>
          {[
            { key: 'backup', label: 'Backup Now', sub: 'Last backup: Today 06:00 AM', icon: '☁️', color: '#0288D1',
              loadMsg: 'Backing up to cloud…', doneMsg: 'Backup complete ✓' },
            { key: 'export', label: 'Export Data (CSV)', sub: 'Download all transactions', icon: '📤', color: '#2E7D32',
              loadMsg: 'Preparing CSV export…', doneMsg: 'Export ready — 12,450 records ✓' },
            { key: 'cache', label: 'Clear Cache', sub: '12.4 MB used', icon: '🗑️', color: '#F57C00',
              loadMsg: 'Clearing cache…', doneMsg: 'Cache cleared — 0 MB ✓' },
          ].map((item, i, arr) => {
            const st = simState[item.key]
            return (
              <button key={item.key} className="btn" onClick={() => st === 'idle' && runSim(item.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? border : 'none', background: 'none', cursor: st === 'idle' ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {st === 'loading' ? <div style={{ width: 18, height: 18, border: `2px solid ${item.color}40`, borderTop: `2px solid ${item.color}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: st === 'done' ? item.color : text }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: st === 'loading' ? item.color : st === 'done' ? item.color : muted, marginTop: 1 }}>
                    {st === 'loading' ? item.loadMsg : st === 'done' ? item.doneMsg : item.sub}
                  </div>
                </div>
                {st === 'idle' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>}
                {st === 'done' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>}
              </button>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{ fontSize: 12, color: muted }}>MobiDuka POS v1.1 · SmartScan™ Integrated</div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
