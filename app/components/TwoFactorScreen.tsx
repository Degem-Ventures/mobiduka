import { useState } from 'react'
import { useColors } from '../utils/theme'

interface Props { onNavigate: (s: string) => void }

export default function TwoFactorScreen({ onNavigate }: Props) {
  const c = useColors()
  const [step, setStep] = useState<'intro' | 'method' | 'verify' | 'done'>('intro')
  const [method, setMethod] = useState<'sms' | 'totp' | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [_enabled, setEnabled] = useState(false)

  const startSetup = (m: 'sms' | 'totp') => {
    setMethod(m)
    setStep('verify')
  }

  const verify = () => {
    if (code.length < 6) return
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      setEnabled(true)
      setStep('done')
    }, 1800)
  }

  const disable2FA = () => {
    setEnabled(false)
    setMethod(null)
    setCode('')
    setStep('intro')
  }

  const methodLabel = method === 'sms' ? 'SMS OTP' : 'Authenticator App'

  if (step === 'done') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Two-Factor Auth</div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: 24, paddingRight: 20, paddingBottom: 80, paddingLeft: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>🛡️</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2E7D32', marginBottom: 8 }}>2FA Enabled!</div>
            <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.5 }}>Your account is now protected with {methodLabel}. You'll be asked for a code on each new login.</div>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{method === 'sms' ? '📱' : '🔐'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{methodLabel}</div>
                <div style={{ fontSize: 11, color: '#2E7D32', marginTop: 2 }}>● Active</div>
              </div>
              <span className="badge badge-success">Enabled</span>
            </div>
          </div>
          <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#FFD54F' : '#5D4037', marginBottom: 4 }}>💡 Backup codes</div>
            <div style={{ fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63', lineHeight: 1.5 }}>Save these in a safe place — they let you sign in if you lose your {method === 'sms' ? 'phone' : 'authenticator'}.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              {['7F2K-9PXM', '3Q8R-T6WN', 'BH4J-K2VL', 'XN9E-5CMR'].map(code => (
                <div key={code} style={{ background: c.card, borderRadius: 8, padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: c.text, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}` }}>{code}</div>
              ))}
            </div>
          </div>
          <button className="btn" onClick={disable2FA} style={{ width: '100%', padding: '14px', background: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#D32F2F', cursor: 'pointer', fontFamily: 'inherit' }}>
            Disable Two-Factor Auth
          </button>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setStep('method')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Verify {methodLabel}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: 24, paddingRight: 20, paddingBottom: 80, paddingLeft: 20 }}>
          {method === 'totp' && (
            <div className="card" style={{ padding: '20px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.muted, marginBottom: 12 }}>Scan with your authenticator app</div>
              {/* Mock QR code */}
              <div style={{ width: 160, height: 160, background: 'linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)', borderRadius: 16, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, padding: 12 }}>
                  {Array.from({ length: 49 }, (_, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 2, background: [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,47,48].includes(i) ? 'white' : 'transparent' }} />
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#123A8F', fontWeight: 700 }}>MBDK-KNYA-2026-SCAN</div>
            </div>
          )}
          {method === 'sms' && (
            <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 4 }}>Code sent to</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>+254 712 *** 678</div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>Check your SMS inbox</div>
            </div>
          )}
          <div className="card" style={{ padding: '20px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Enter 6-digit code</label>
            <input className="input" type="number" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
              onChange={e => setCode(e.target.value.slice(0, 6))}
              style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: 8 }} />
            <button className="btn" onClick={verify} disabled={code.length < 6 || verifying} style={{
              width: '100%', marginTop: 16, padding: '15px',
              background: code.length >= 6 ? 'linear-gradient(135deg, #123A8F, #1A4FBF)' : '#E8ECF4',
              border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
              color: code.length >= 6 ? 'white' : '#B0BAD3',
              cursor: code.length >= 6 ? 'pointer' : 'default', fontFamily: 'inherit',
              boxShadow: code.length >= 6 ? '0 4px 16px rgba(18,58,143,0.35)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {verifying ? (
                <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Verifying…</>
              ) : 'Verify & Enable'}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (step === 'method') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setStep('intro')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Choose Method</div>
          </div>
        </div>
        <div className="scroll-area" style={{ paddingTop: 20, paddingRight: 16, paddingBottom: 80, paddingLeft: 16 }}>
          {[
            { key: 'sms', icon: '📱', title: 'SMS OTP', sub: 'Receive a one-time code via text message to +254 712 *** 678', rec: false },
            { key: 'totp', icon: '🔐', title: 'Authenticator App', sub: 'Use Google Authenticator, Authy, or any TOTP app', rec: true },
          ].map(m => (
            <button key={m.key} className="btn card" onClick={() => startSetup(m.key as 'sms' | 'totp')} style={{ width: '100%', textAlign: 'left', padding: '18px 16px', marginBottom: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{m.title}</div>
                  {m.rec && <span className="badge badge-blue" style={{ fontSize: 9 }}>RECOMMENDED</span>}
                </div>
                <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.4 }}>{m.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 4 }}><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
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
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Two-Factor Auth</div>
            <span style={{ background: 'rgba(211,47,47,0.25)', border: '1px solid rgba(239,154,154,0.4)', borderRadius: 100, padding: '2px 10px', fontSize: 10, fontWeight: 700, color: '#FF8A80' }}>NOT ENABLED</span>
          </div>
        </div>
      </div>
      <div className="scroll-area" style={{ paddingTop: 24, paddingRight: 20, paddingBottom: 80, paddingLeft: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: c.text, marginBottom: 8 }}>Add Extra Security</div>
          <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6 }}>Two-factor authentication adds a second layer of protection to your MobiDuka account. Even if someone knows your PIN, they can't sign in without your second factor.</div>
        </div>
        {[
          { icon: '🔑', title: 'Stronger security', sub: 'Prevents unauthorised access even if your PIN is compromised' },
          { icon: '📲', title: 'Quick to set up', sub: 'Takes less than 2 minutes — works on any device' },
          { icon: '🌐', title: 'Works offline', sub: 'Authenticator apps work without internet connection' },
        ].map((b, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{b.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{b.title}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{b.sub}</div>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setStep('method')} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(18,58,143,0.4)' }}>
          Enable Two-Factor Auth
        </button>
      </div>
    </div>
  )
}
