import { useState } from 'react'

interface Props {
  onLogin: () => void
}

export default function LoginScreen({ onLogin }: Props) {
  const [step, setStep] = useState<'splash' | 'login' | 'pin'>('splash')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('admin@mobiduka.co.ke')
  const [password, setPassword] = useState('••••••••')

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      const next = pin + digit
      setPin(next)
      if (next.length === 4) {
        setTimeout(() => onLogin(), 400)
      }
    }
  }

  const handlePinDelete = () => setPin(p => p.slice(0, -1))

  if (step === 'splash') {
    return (
      <div className="screen" style={{ background: 'linear-gradient(160deg, #0D1B3D 0%, #123A8F 60%, #1A4FBF 100%)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
          {/* Logo */}
          <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: 28,
              background: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 50%, #C9A227 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(212,175,55,0.4)',
              marginBottom: 20
            }}>
              {/* Shop + phone icon */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                {/* Awning */}
                <path d="M8 22 L28 10 L48 22 Z" fill="#0D1B3D" opacity="0.9" />
                <rect x="10" y="22" width="36" height="22" rx="3" fill="#0D1B3D" opacity="0.8" />
                <rect x="17" y="28" width="10" height="16" rx="2" fill="#D4AF37" opacity="0.9" />
                {/* Phone overlay */}
                <rect x="30" y="26" width="16" height="22" rx="4" fill="white" opacity="0.95" />
                <rect x="32" y="30" width="12" height="14" rx="2" fill="#123A8F" opacity="0.8" />
                <circle cx="38" cy="46" r="1.5" fill="#666" />
              </svg>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: -0.5 }}>MobiDuka</div>
            <div style={{ fontSize: 14, color: 'rgba(212,175,55,0.9)', fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>Point of Sale</div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 1.6, marginBottom: 60 }}>
            Smart retail management for<br />modern businesses
          </div>

          {/* Loading dots */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === 0 ? '#D4AF37' : 'rgba(255,255,255,0.3)'
              }} />
            ))}
          </div>
        </div>

        <div style={{ paddingBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <button className="btn" onClick={() => setStep('login')} style={{
            width: '80%', padding: '16px',
            background: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)',
            border: 'none', borderRadius: 16,
            fontSize: 16, fontWeight: 700, color: '#0D1B3D',
            fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(212,175,55,0.4)'
          }}>
            Get Started
          </button>
          <button className="btn" onClick={() => setStep('pin')} style={{
            width: '80%', padding: '14px',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 16, fontSize: 15, fontWeight: 600, color: 'white', fontFamily: 'inherit'
          }}>
            Quick PIN Login
          </button>
        </div>
      </div>
    )
  }

  if (step === 'pin') {
    return (
      <div className="screen" style={{ background: 'linear-gradient(160deg, #0D1B3D 0%, #123A8F 100%)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 28, fontWeight: 700, color: '#0D1B3D'
          }}>A</div>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin User</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 48 }}>MobiDuka Store</div>

          {/* PIN dots */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 48 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: i < pin.length ? '#D4AF37' : 'rgba(255,255,255,0.2)',
                border: '2px solid',
                borderColor: i < pin.length ? '#D4AF37' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.2s'
              }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 280 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
              <button key={i} className="btn" onClick={() => key === '⌫' ? handlePinDelete() : key && handlePinPress(key)}
                style={{
                  height: 64, borderRadius: 16,
                  background: key === '' ? 'transparent' : 'rgba(255,255,255,0.1)',
                  border: key === '' ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  color: 'white', fontSize: key === '⌫' ? 20 : 24, fontWeight: 500,
                  fontFamily: 'inherit', cursor: key === '' ? 'default' : 'pointer'
                }}>
                {key}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 32px 40px', display: 'flex', justifyContent: 'center' }}>
          <button className="btn" onClick={() => setStep('login')} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit'
          }}>
            Use email & password instead
          </button>
        </div>
      </div>
    )
  }

  // Login form
  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)',
        padding: '60px 28px 40px',
        borderRadius: '0 0 32px 32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 9L12 4L21 9V20H3V9Z" fill="#0D1B3D" opacity="0.9" />
              <rect x="7" y="12" width="4" height="8" rx="1" fill="#D4AF37" />
              <rect x="13" y="12" width="4" height="5" rx="1" fill="white" opacity="0.8" />
            </svg>
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>MobiDuka POS</div>
            <div style={{ color: 'rgba(212,175,55,0.8)', fontSize: 12, fontWeight: 500 }}>Business Management</div>
          </div>
        </div>
        <div style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>Welcome back</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>Sign in to your account</div>
      </div>

      {/* Form */}
      <div style={{ padding: '32px 24px', flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Email Address</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Password</label>
          <input className="input" value={password} onChange={e => setPassword(e.target.value)} type="password" />
        </div>

        <div style={{ textAlign: 'right', marginBottom: 28 }}>
          <button style={{ background: 'none', border: 'none', color: '#123A8F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Forgot Password?
          </button>
        </div>

        <button className="btn" onClick={onLogin} style={{
          width: '100%', padding: '16px',
          background: 'linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)',
          border: 'none', borderRadius: 16,
          fontSize: 16, fontWeight: 700, color: 'white', fontFamily: 'inherit',
          boxShadow: '0 4px 20px rgba(18,58,143,0.35)'
        }}>
          Sign In
        </button>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn" onClick={() => setStep('pin')} style={{
            background: 'rgba(18,58,143,0.08)', border: 'none',
            borderRadius: 12, padding: '12px 24px',
            fontSize: 14, fontWeight: 600, color: '#123A8F', fontFamily: 'inherit', cursor: 'pointer'
          }}>
            Use PIN Login instead
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#6B7A99' }}>MobiDuka POS v2.4.1 · Kenya</div>
        <div style={{ fontSize: 11, color: '#B0BAD3', marginTop: 4 }}>Powered by MobiTech Solutions Ltd</div>
      </div>
    </div>
  )
}
