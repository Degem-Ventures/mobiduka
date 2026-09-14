import { useState } from 'react'
import { useColors } from '../utils/theme'

interface Props { onNavigate: (s: string) => void }

const sessions = [
  { id: 1, device: 'Android Phone', model: 'Samsung Galaxy A54', location: 'Nairobi, Kenya', lastActive: 'Now', ip: '197.232.xx.xx', current: true, icon: '📱' },
  { id: 2, device: 'Desktop Browser', model: 'Chrome on Windows 11', location: 'Nairobi, Kenya', lastActive: '2 days ago', ip: '197.232.xx.yy', current: false, icon: '💻' },
  { id: 3, device: 'Android Tablet', model: 'Samsung Galaxy Tab A8', location: 'Mombasa, Kenya', lastActive: '8 days ago', ip: '105.160.xx.zz', current: false, icon: '📲' },
]

export default function ActiveSessionsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [list, setList] = useState(sessions)
  const [revoking, setRevoking] = useState<number | null>(null)
  const [revokedAll, setRevokedAll] = useState(false)

  const revoke = (id: number) => {
    setRevoking(id)
    setTimeout(() => {
      setList(l => l.filter(s => s.id === 1)) // keep current only
      setRevoking(null)
    }, 1200)
  }

  const revokeAll = () => {
    setRevokedAll(true)
    setTimeout(() => {
      setList(l => l.filter(s => s.current))
      setRevokedAll(false)
    }, 1500)
  }

  const others = list.filter(s => !s.current)

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Active Sessions</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{list.length} device{list.length !== 1 ? 's' : ''} logged in</div>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>

        {/* Current device */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>This Device</div>
        {list.filter(s => s.current).map(s => (
          <div key={s.id} className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.device}</div>
                  <span className="badge badge-success">Current</span>
                </div>
                <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{s.model}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>📍 {s.location} · {s.ip}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: c.successBg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2E7D32', flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>Active now</div>
            </div>
          </div>
        ))}

        {/* Other devices */}
        {others.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginLeft: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Other Devices</div>
              <button className="btn" onClick={revokeAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: revokedAll ? c.muted : '#D32F2F', fontFamily: 'inherit' }}>
                {revokedAll ? 'Signing out…' : 'Sign out all'}
              </button>
            </div>
            <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
              {others.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < others.length - 1 ? c.divider : 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.device}</div>
                    <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{s.model}</div>
                    <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>📍 {s.location} · Last: {s.lastActive}</div>
                  </div>
                  <button className="btn" onClick={() => revoke(s.id)} style={{
                    background: revoking === s.id ? c.iconBg : 'rgba(211,47,47,0.1)',
                    border: '1px solid rgba(211,47,47,0.2)', borderRadius: 10,
                    padding: '7px 12px', fontSize: 11, fontWeight: 600,
                    color: revoking === s.id ? c.muted : '#D32F2F',
                    cursor: revoking === s.id ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}>
                    {revoking === s.id ? '…' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {others.length === 0 && (
          <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2E7D32' }}>Only this device is active</div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>Your account is secure</div>
          </div>
        )}

        <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 14, padding: '14px 16px', marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#FFD54F' : '#5D4037', marginBottom: 4 }}>🔒 Security tip</div>
          <div style={{ fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63', lineHeight: 1.5 }}>If you don't recognise a session, revoke it immediately and change your PIN from User Profile.</div>
        </div>
      </div>
    </div>
  )
}
