import { useState } from 'react'
import { useColors } from '../utils/theme'

const roles = [
  { id: 'admin',      label: 'Admin',      icon: '👑', desc: 'Full system access' },
  { id: 'manager',    label: 'Manager',    icon: '🏪', desc: 'Reports & inventory' },
  { id: 'cashier',    label: 'Cashier',    icon: '💳', desc: 'POS & sales only' },
  { id: 'supervisor', label: 'Supervisor', icon: '🔍', desc: 'Oversight & shifts' },
]

const branches = ['Nairobi CBD', 'Westlands', 'Karen', 'Thika Rd', 'Mombasa']

interface Props { onNavigate: (s: string) => void }

export default function AdminRegisterScreen({ onNavigate }: Props) {
  const c = useColors()
  const [step, setStep] = useState<'form' | 'pin' | 'done'>('form')
  const [form, setForm] = useState({
    name: '', phone: '', email: '', role: 'cashier', branch: 'Nairobi CBD', department: '',
  })
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')

  const initials = form.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const canProceed = form.name.trim() && form.phone.trim() && form.email.trim()

  const handlePinSave = () => {
    if (pin.length < 4) { setPinError('PIN must be 4 digits'); return }
    if (pin !== confirmPin) { setPinError('PINs do not match'); return }
    setPinError('')
    setStep('done')
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    const role = roles.find(r => r.id === form.role)
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#0D1B3D', marginBottom: 20 }}>
            {initials}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: c.text, marginBottom: 6 }}>{form.name}</div>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 24 }}>
            {role?.icon} {role?.label} · {form.branch}
          </div>
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 14, padding: '16px 20px', width: '100%', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32', marginBottom: 6 }}>✅ Account Created Successfully</div>
            <div style={{ fontSize: 12, color: c.muted }}>Login credentials sent to {form.email}</div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>User can log in with their PIN or password</div>
          </div>
          <button className="btn" onClick={() => onNavigate('employees')} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Back to Staff
          </button>
          <button className="btn" onClick={() => { setStep('form'); setForm({ name: '', phone: '', email: '', role: 'cashier', branch: 'Nairobi CBD', department: '' }); setPin(''); setConfirmPin('') }} style={{ marginTop: 12, background: 'none', border: 'none', color: '#123A8F', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Register Another User
          </button>
        </div>
      </div>
    )
  }

  // ── Set PIN ───────────────────────────────────────────────────────────────
  if (step === 'pin') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <button className="btn" onClick={() => setStep('form')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Set Login PIN</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>For {form.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#0D1B3D', border: '3px solid rgba(255,255,255,0.3)' }}>
              {initials}
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '24px 20px 100px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>4-Digit PIN *</label>
              <input
                type="password" inputMode="numeric" maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                className="input"
                style={{ textAlign: 'center', fontSize: 32, letterSpacing: 16, fontWeight: 800 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Confirm PIN *</label>
              <input
                type="password" inputMode="numeric" maxLength={4}
                placeholder="••••"
                value={confirmPin}
                onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                className="input"
                style={{ textAlign: 'center', fontSize: 32, letterSpacing: 16, fontWeight: 800 }}
              />
            </div>
            {pinError && (
              <div style={{ background: c.errorBg, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#D32F2F', marginBottom: 12 }}>
                ⚠️ {pinError}
              </div>
            )}
            <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63' }}>
              🔒 Ask the user to change this PIN at their first login
            </div>
          </div>
          <button className="btn" onClick={handlePinSave} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            Create Account
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <button className="btn" onClick={() => onNavigate('employees')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Register New User</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#0D1B3D', border: '3px solid rgba(255,255,255,0.3)' }}>
            {initials}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Avatar preview updates as you type</div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>

        {/* Personal Info */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Personal Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[
            { label: 'Full Name *', key: 'name', placeholder: 'e.g. Grace Wanjiku', type: 'text' },
            { label: 'Phone Number *', key: 'phone', placeholder: '07XX XXX XXX', type: 'tel' },
            { label: 'Email Address *', key: 'email', placeholder: 'user@store.co.ke', type: 'email' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input
                className="input" type={f.type} placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* Role */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Role & Permissions</div>
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {roles.map(r => (
              <button key={r.id} className="btn" onClick={() => setForm(p => ({ ...p, role: r.id }))} style={{
                padding: '14px 10px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: form.role === r.id
                  ? (c.isDark ? 'rgba(18,58,143,0.35)' : 'rgba(18,58,143,0.08)')
                  : c.cardAlt,
                border: form.role === r.id
                  ? '2px solid #123A8F'
                  : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{r.label}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Store Assignment */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Store Assignment</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Branch *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {branches.map(br => (
                <button key={br} className="btn" onClick={() => setForm(p => ({ ...p, branch: br }))} style={{
                  padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                  border: form.branch === br ? '2px solid #123A8F' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`,
                  background: form.branch === br ? (c.isDark ? 'rgba(18,58,143,0.3)' : 'rgba(18,58,143,0.08)') : c.card,
                  color: form.branch === br ? '#123A8F' : c.muted,
                  fontSize: 12, fontWeight: 600,
                }}>
                  {br}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Department (optional)</label>
            <input className="input" placeholder="e.g. Cashier Desk, Warehouse, Admin" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
          </div>
        </div>

        {/* Permissions summary */}
        <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>{roles.find(r => r.id === form.role)?.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{roles.find(r => r.id === form.role)?.label} Permissions</div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 4, lineHeight: 1.5 }}>
              {form.role === 'admin' && 'Full access: users, settings, reports, POS, inventory, financials'}
              {form.role === 'manager' && 'Reports, inventory, suppliers, expenses — no user management'}
              {form.role === 'cashier' && 'POS sales only — no reports, settings, or financial data'}
              {form.role === 'supervisor' && 'Shift oversight, POS monitoring, staff reports'}
            </div>
          </div>
        </div>

        <button className="btn" onClick={() => setStep('pin')} disabled={!canProceed} style={{
          width: '100%', padding: '16px',
          background: canProceed ? 'linear-gradient(135deg, #123A8F, #1A4FBF)' : (c.isDark ? '#162B5A' : '#E3EAF8'),
          border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700,
          color: canProceed ? 'white' : c.muted,
          cursor: canProceed ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          Next: Set Login PIN →
        </button>
      </div>
    </div>
  )
}
