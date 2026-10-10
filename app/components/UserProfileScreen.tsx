import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { formatPhoneForDisplay } from '../utils/format-phone'
import { apiFetch, getClientSession } from '../../lib/client-api'
import {
  fetchCachedCollection,
  isNativeOfflineApp,
  readOfflineCollectionUpdatedAt,
  writeOfflineCollection,
} from '../../lib/offline-store'
import { useAutoDismissMessage } from '../../lib/use-auto-dismiss-message'

interface Props { onNavigate: (s: string) => void }
type Profile = { id: string; name: string; phone: string | null; email: string | null; role: string; memberSince: string; pinConfigured: boolean; business: { name: string; branch: string | null; country: string | null } }

export default function UserProfileScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [editing, setEditing] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', store: '', branch: '' })
  const [pinForm, setPinForm] = useState({ current: '', newPin: '', confirm: '' })
  const [pinError, setPinError] = useAutoDismissMessage()
  const [pinDone, setPinDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dataError, setDataError] = useAutoDismissMessage()
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null)
  const initials = (profile?.name ?? 'User').split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!session) { setDataError('Please sign in to load your profile.'); return }
    let cancelled = false
    const cacheKey = `profile.v1:${session.user.id}`
    const loadProfile = async () => {
      let previousUpdatedAt: string | null = null
      try {
        previousUpdatedAt = await readOfflineCollectionUpdatedAt(session.user.businessId, cacheKey)
      } catch (reason) {
        console.error('Unable to read the profile snapshot timestamp.', reason)
      }
      try {
        const response = await fetchCachedCollection<{ profile: Profile }>(
          session.user.businessId,
          cacheKey,
          `/api/profile?businessId=${encodeURIComponent(session.user.businessId)}`,
        )
        if (cancelled) return
        setProfile(response.profile)
        setForm({ name: response.profile.name, phone: response.profile.phone ?? '', email: response.profile.email ?? '', store: response.profile.business.name, branch: response.profile.business.branch ?? '' })
        let updatedAt: string | null = null
        try {
          updatedAt = await readOfflineCollectionUpdatedAt(session.user.businessId, cacheKey)
        } catch (reason) {
          console.error('Unable to read the profile snapshot timestamp.', reason)
        }
        if (cancelled) return
        setSnapshotUpdatedAt(updatedAt)
        setIsOfflineSnapshot(
          isNativeOfflineApp() &&
          (!navigator.onLine || (updatedAt !== null && previousUpdatedAt === updatedAt)),
        )
        setDataError('')
      } catch (reason) {
        if (!cancelled) setDataError(reason instanceof Error ? reason.message : 'Unable to load profile.')
      }
    }
    const handleOnline = () => void loadProfile()
    const handleOffline = () => {
      if (isNativeOfflineApp()) {
        setIsOfflineSnapshot(true)
        setEditing(false)
      }
    }
    void loadProfile()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [session?.user.id, session?.user.businessId])

  const handleSave = async () => {
    if (!session || isOfflineSnapshot) return
    try {
      const response = await apiFetch<{ profile: Profile }>('/api/profile', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, name: form.name, phone: form.phone, email: form.email, businessName: form.store, businessBranch: form.branch }) })
      setProfile(response.profile)
      try {
        const cacheKey = `profile.v1:${session.user.id}`
        await writeOfflineCollection(session.user.businessId, cacheKey, response)
        setSnapshotUpdatedAt(await readOfflineCollectionUpdatedAt(session.user.businessId, cacheKey))
      } catch (error) {
        console.error('Unable to update the cached profile.', error)
      }
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to update profile.') }
  }

  const updatePin = async () => {
    if (!session || isOfflineSnapshot) return
    if (profile?.pinConfigured && !pinForm.current) { setPinError('Enter your current PIN'); return }
    if (pinForm.newPin.length !== 4) { setPinError('New PIN must be 4 digits'); return }
    if (pinForm.newPin !== pinForm.confirm) { setPinError('New PINs do not match'); return }
    try {
      await apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, ...(profile?.pinConfigured ? { currentPin: pinForm.current } : {}), newPin: pinForm.newPin }) })
      setPinError('')
      setPinDone(true)
    } catch (reason) { setPinError(reason instanceof Error ? reason.message : 'Unable to update PIN.') }
  }

  if (changingPin) {
    return (
      <div className="screen" style={{ background: c.bg }}>
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
            {pinDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.text, marginBottom: 8 }}>PIN Updated!</div>
                <div style={{ fontSize: 13, color: c.muted, marginBottom: 24, lineHeight: 1.6 }}>Your new PIN is active.<br />Use it on your next login.</div>
                <button className="btn" onClick={() => { setChangingPin(false); setPinDone(false); setPinForm({ current: '', newPin: '', confirm: '' }) }} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                {[
                  ...(profile?.pinConfigured ? [{ label: 'Current PIN', key: 'current', placeholder: '••••' }] : []),
                  { label: profile?.pinConfigured ? 'New PIN' : 'Create PIN', key: 'newPin', placeholder: '••••' },
                  { label: 'Confirm New PIN', key: 'confirm', placeholder: '••••' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>{f.label}</label>
                    <input type="password" inputMode="numeric" maxLength={4} placeholder={f.placeholder}
                      value={pinForm[f.key as keyof typeof pinForm]}
                      onChange={e => { setPinForm(p => ({ ...p, [f.key]: e.target.value.replace(/\D/g, '') })); setPinError('') }}
                      className="input"
                      style={{ textAlign: 'center', fontSize: 28, letterSpacing: 12, fontWeight: 800 }} />
                  </div>
                ))}
                {pinError && (
                  <div style={{ background: c.errorBg, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#D32F2F', marginBottom: 16 }}>⚠️ {pinError}</div>
                )}
                {isOfflineSnapshot && <div role="status" style={{ background: '#FFF8E1', color: '#795548', borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12 }}>PIN changes require an internet connection.</div>}
                <button className="btn" disabled={isOfflineSnapshot} onClick={() => void updatePin()} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: isOfflineSnapshot ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)', opacity: isOfflineSnapshot ? 0.7 : 1 }}>
                  Update PIN
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>User Profile</div>
          <button className="btn" disabled={isOfflineSnapshot} onClick={() => setEditing(!editing)} style={{ marginLeft: 'auto', background: editing ? '#D4AF37' : 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: editing ? '#0D1B3D' :  'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#0D1B3D', border: '3px solid rgba(255,255,255,0.3)' }}>{initials}</div>
            {editing && (
              <button className="btn" style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#D4AF37', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>✏️</button>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>{profile?.name ?? 'Loading profile…'}</div>
            <span style={{ background: 'rgba(212,175,55,0.25)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 100, padding: '3px 12px', fontSize: 11, fontWeight: 600, color: '#D4AF37', marginTop: 6, display: 'inline-block' }}>{profile?.role ?? 'User'}</span>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {isOfflineSnapshot && (
          <div role="status" style={{ background: '#FFF8E1', color: '#795548', borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12 }}>
            Showing saved profile{snapshotUpdatedAt ? ` from ${new Date(snapshotUpdatedAt).toLocaleString()}` : ''}. Profile and PIN changes require internet.
          </div>
        )}
        {dataError && <div style={{ background: c.errorBg, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#D32F2F', marginBottom: 16 }}>{dataError}</div>}
        {saved && (
          <div style={{ background: c.successBg, border: '1px solid #C8E6C9', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Profile updated successfully</span>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Personal Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[
            { label: 'Full Name', key: 'name' },
            { label: 'Phone Number', key: 'phone' },
            { label: 'Email Address', key: 'email' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
              {editing ? (
                <input className="input" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: c.text, padding: '10px 0', borderBottom: c.divider }}>{f.key === 'phone' ? formatPhoneForDisplay(form.phone) : form[f.key as keyof typeof form]}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Store Information</div>
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          {[{ label: 'Store Name', key: 'store' }, { label: 'Branch', key: 'branch' }].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
              {editing ? (
                <input className="input" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: c.text, padding: '10px 0', borderBottom: c.divider }}>{form[f.key as keyof typeof form] || '—'}</div>
              )}
            </div>
          ))}
          {editing && (
            <button className="btn" onClick={handleSave} style={{ width: '100%', marginTop: 8, padding: '14px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Save Changes</button>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Security</div>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {[
            { label: 'Change PIN', sub: 'Update your 4-digit login PIN', icon: '🔐', action: () => setChangingPin(true) },
            { label: 'Active Sessions', sub: '3 devices currently logged in', icon: '📱', action: () => onNavigate('sessions') },
            { label: 'Two-Factor Auth', sub: 'Not enabled', icon: '🛡️', action: () => onNavigate('twofa') },
          ].map((item, i, arr) => (
            <button key={i} className="btn" onClick={item.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? c.divider : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.faint} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        <div style={{ background: c.cardAlt, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: c.faint }}>Member since {profile ? new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'}</div>
          <div style={{ fontSize: 12, color: c.faint, marginTop: 2 }}>MobiDuka POS · {profile?.role ?? 'User'} · {profile?.business.name ?? '—'} · {profile?.business.branch ?? '—'}</div>
        </div>
      </div>
    </div>
  )
}
