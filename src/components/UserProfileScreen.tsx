import { useState } from 'react'

interface Props { onNavigate: (s: string) => void }

export default function UserProfileScreen({ onNavigate }: Props) {
  const [editing, setEditing] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [form, setForm] = useState({ name: 'Admin User', phone: '0712 345 678', email: 'admin@mobiduka.co.ke', store: 'MobiDuka Store', branch: 'Nairobi CBD' })
  const [pinForm, setPinForm] = useState({ current: '', newPin: '', confirm: '' })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (changingPin) {
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setChangingPin(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Change PIN</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '24px' }}>
            {[
              { label: 'Current PIN', key: 'current', placeholder: '••••' },
              { label: 'New PIN', key: 'newPin', placeholder: '••••' },
              { label: 'Confirm New PIN', key: 'confirm', placeholder: '••••' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 8 }}>{f.label}</label>
                <input type="password" maxLength={4} placeholder={f.placeholder}
                  value={pinForm[f.key as keyof typeof pinForm]}
                  onChange={e => setPinForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="input"
                  style={{ textAlign: 'center', fontSize: 28, letterSpacing: 12, fontWeight: 800 }} />
              </div>
            ))}
            <button className="btn" onClick={() => setChangingPin(false)} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
              Update PIN
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>User Profile</div>
          <button className="btn" onClick={() => setEditing(!editing)} style={{ marginLeft: 'auto', background: editing ? '#D4AF37' : 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: editing ? '#0D1B3D' : 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#0D1B3D', border: '3px solid rgba(255,255,255,0.3)' }}>A</div>
            {editing && (
              <button className="btn" style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#D4AF37', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>✏️</button>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>{form.name}</div>
            <span style={{ background: 'rgba(212,175,55,0.25)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 100, padding: '3px 12px', fontSize: 11, fontWeight: 600, color: '#D4AF37', marginTop: 6, display: 'inline-block' }}>Store Manager</span>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {saved && (
          <div style={{ background: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Profile updated successfully</span>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Personal Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[
            { label: 'Full Name', key: 'name' },
            { label: 'Phone Number', key: 'phone' },
            { label: 'Email Address', key: 'email' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>{f.label}</label>
              {editing ? (
                <input className="input" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B3D', padding: '10px 0', borderBottom: '1px solid #F0F3F9' }}>{form[f.key as keyof typeof form]}</div>
              )}
            </div>
          ))}
          {editing && (
            <button className="btn" onClick={handleSave} style={{ width: '100%', marginTop: 8, padding: '14px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Save Changes</button>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Store Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[{ label: 'Store Name', key: 'store' }, { label: 'Branch', key: 'branch' }].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>{f.label}</label>
              {editing ? (
                <input className="input" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B3D', padding: '10px 0', borderBottom: '1px solid #F0F3F9' }}>{form[f.key as keyof typeof form]}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Security</div>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {[
            { label: 'Change PIN', sub: 'Update your 4-digit login PIN', icon: '🔐', action: () => setChangingPin(true) },
            { label: 'Active Sessions', sub: '1 device currently logged in', icon: '📱', action: () => {} },
            { label: 'Two-Factor Auth', sub: 'Not enabled', icon: '🛡️', action: () => {} },
          ].map((item, i, arr) => (
            <button key={i} className="btn" onClick={item.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: '#E3EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        <div style={{ background: '#F5F7FA', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#B0BAD3' }}>Member since January 2024</div>
          <div style={{ fontSize: 12, color: '#B0BAD3', marginTop: 2 }}>MobiDuka POS · Store Manager</div>
        </div>
      </div>
    </div>
  )
}
