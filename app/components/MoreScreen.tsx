import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { ApiResponseError, apiFetch, getClientSession } from '../../lib/client-api'
import {
  isNativeOfflineApp,
  readOfflineCollection,
  readOfflineCollectionUpdatedAt,
  writeOfflineCollection,
} from '../../lib/offline-store'

interface Props {
  onLogout: () => void
  onNavigate: (s: string) => void
}

const menuItems = [
  { section: 'Sales & Finance', items: [
    { label: 'Sales History', icon: '🧾', color: '#123A8F', screen: 'reports' },
    { label: 'Purchase Orders', icon: '📦', color: '#2E7D32', screen: 'purchases' },
    { label: 'Suppliers', icon: '🏭', color: '#00796B', screen: 'suppliers' },
    { label: 'Credit Book', icon: '📋', color: '#D32F2F', screen: 'credit' },
    { label: 'Expense Tracking', icon: '💸', color: '#F57C00', screen: 'expenses' },
  ]},
  { section: 'People', items: [
    { label: 'Employees', icon: '👥', color: '#5E35B1', screen: 'employees' },
    { label: 'Customer List', icon: '🙂', color: '#0288D1', screen: 'customers' },
  ]},
  { section: 'System', items: [
    { label: 'Notifications', icon: '🔔', color: '#E91E63', screen: 'notifications' },
    { label: 'Backup & Cloud Sync', icon: '☁️', color: '#0288D1', screen: 'backup' },
    { label: 'Settings', icon: '⚙️', color: '#546E7A', screen: 'settings' },
    { label: 'User Profile', icon: '👤', color: '#123A8F', screen: 'profile' },
  ]},
]

type ProfileResponse = {
  profile: {
    name: string
    email: string | null
    role: string
    business: { name: string; branch: string | null }
  }
}
type NotificationCountResponse = { unreadCount: number }
type SettingsOverviewSnapshot = { business: { name: string; branch: string | null } }

export default function MoreScreen({ onLogout, onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [businessInfo, setBusinessInfo] = useState({ name: 'Business', branch: 'Branch' })
  const [userInfo, setUserInfo] = useState({
    name: session?.user.name ?? '',
    email: '',
    role: session?.user.role ?? '',
  })
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null)
  const [overviewError, setOverviewError] = useState('')

  useEffect(() => {
    if (!session) return
    let active = true
    let requestId = 0
    const businessId = session.user.businessId
    const profileCacheKey = `profile.v1:${session.user.id}`
    const notificationCacheKey = 'dashboard.notifications.v1'
    const settingsCacheKey = 'settings.overview.v1'
    const isOfflineOnly = () =>
      isNativeOfflineApp() && (!navigator.onLine || Boolean(session.user.offline))
    const isNetworkFailure = (error: unknown) =>
      error instanceof TypeError ||
      (error instanceof ApiResponseError && error.status >= 500)

    const applyProfile = (response: ProfileResponse) => {
      setUserInfo({
        name: response.profile.name,
        email: response.profile.email ?? '',
        role: response.profile.role,
      })
      setBusinessInfo({
        name: response.profile.business.name,
        branch: response.profile.business.branch ?? 'Branch',
      })
    }

    const loadOverview = async () => {
      const currentRequestId = ++requestId
      let usedSnapshot = isOfflineOnly()
      let profileLoaded = false
      let latestSnapshotTime: string | null = null
      const errors: string[] = []
      const recordSnapshotTime = async (cacheKey: string) => {
        try {
          const updatedAt = await readOfflineCollectionUpdatedAt(businessId, cacheKey)
          if (updatedAt && (!latestSnapshotTime || updatedAt > latestSnapshotTime)) {
            latestSnapshotTime = updatedAt
          }
        } catch (error) {
          console.error(`Unable to read the ${cacheKey} snapshot timestamp.`, error)
        }
      }

      const loadProfile = async () => {
        if (isOfflineOnly()) {
          const cached = await readOfflineCollection<ProfileResponse>(businessId, profileCacheKey)
          if (cached) {
            applyProfile(cached)
            profileLoaded = true
            await recordSnapshotTime(profileCacheKey)
          }
          return
        }
        try {
          const response = await apiFetch<ProfileResponse>('/api/profile')
          if (!active || currentRequestId !== requestId) return
          applyProfile(response)
          profileLoaded = true
          try {
            await writeOfflineCollection(businessId, profileCacheKey, response)
            await recordSnapshotTime(profileCacheKey)
          } catch (error) {
            console.error('Unable to cache the More-screen profile summary.', error)
          }
        } catch (error) {
          if (!isNativeOfflineApp() || !isNetworkFailure(error)) throw error
          const cached = await readOfflineCollection<ProfileResponse>(businessId, profileCacheKey)
          if (cached) {
            if (!active || currentRequestId !== requestId) return
            applyProfile(cached)
            profileLoaded = true
            usedSnapshot = true
            await recordSnapshotTime(profileCacheKey)
          } else {
            usedSnapshot = true
          }
        }
      }

      const loadUnreadCount = async () => {
        if (isOfflineOnly()) {
          const cached = await readOfflineCollection<NotificationCountResponse>(businessId, notificationCacheKey)
          if (cached && typeof cached.unreadCount === 'number') {
            setUnreadNotifications(cached.unreadCount)
            await recordSnapshotTime(notificationCacheKey)
            return
          }
          const cachedNotifications = await readOfflineCollection<{ notifications: Array<{ read: boolean }> }>(
            businessId,
            'notifications.list.v1',
          )
          if (cachedNotifications) {
            setUnreadNotifications(cachedNotifications.notifications.filter(notification => !notification.read).length)
            await recordSnapshotTime('notifications.list.v1')
          }
          return
        }
        try {
          const response = await apiFetch<NotificationCountResponse>(
            `/api/notifications?businessId=${encodeURIComponent(businessId)}`,
          )
          if (!active || currentRequestId !== requestId) return
          setUnreadNotifications(response.unreadCount)
          try {
            await writeOfflineCollection(businessId, notificationCacheKey, response)
            await recordSnapshotTime(notificationCacheKey)
          } catch (error) {
            console.error('Unable to cache the More-screen notification count.', error)
          }
        } catch (error) {
          if (!isNativeOfflineApp() || !isNetworkFailure(error)) throw error
          const cached = await readOfflineCollection<NotificationCountResponse>(businessId, notificationCacheKey)
          if (cached && typeof cached.unreadCount === 'number') {
            if (!active || currentRequestId !== requestId) return
            setUnreadNotifications(cached.unreadCount)
            usedSnapshot = true
            await recordSnapshotTime(notificationCacheKey)
          } else {
            usedSnapshot = true
          }
        }
      }

      const loadBusinessFallback = async () => {
        if (profileLoaded) return
        const cached = await readOfflineCollection<SettingsOverviewSnapshot & { business?: SettingsOverviewSnapshot['business'] }>(
          businessId,
          settingsCacheKey,
        )
        if (cached?.business) {
          setBusinessInfo({
            name: cached.business.name,
            branch: cached.business.branch ?? 'Branch',
          })
          await recordSnapshotTime(settingsCacheKey)
        }
      }

      const tasks = await Promise.allSettled([loadProfile(), loadUnreadCount()])
      if (!active || currentRequestId !== requestId) return
      for (const result of tasks) {
        if (result.status === 'rejected') {
          console.error('Unable to refresh More-screen overview data.', result.reason)
          errors.push(result.reason instanceof Error ? result.reason.message : 'Some overview details could not be loaded.')
        }
      }
      if (!profileLoaded) {
        try {
          await loadBusinessFallback()
        } catch (error) {
          console.error('Unable to load cached business overview details.', error)
          errors.push(error instanceof Error ? error.message : 'Saved business details could not be loaded.')
        }
      }
      if (!active || currentRequestId !== requestId) return
      setIsOfflineSnapshot(usedSnapshot || (isNativeOfflineApp() && !navigator.onLine))
      setSnapshotUpdatedAt(latestSnapshotTime)
      setOverviewError(errors.join(' '))
    }

    const handleOnline = () => void loadOverview()
    const handleOffline = () => {
      if (isNativeOfflineApp()) {
        setIsOfflineSnapshot(true)
        void loadOverview()
      }
    }
    void loadOverview()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [session?.user.id, session?.user.businessId])

  const roleLabel = userInfo.role
    .toLowerCase()
    .replace('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
  const avatarInitial = userInfo.name.trim().charAt(0).toUpperCase()

  return (
    <div className="screen" style={{ background: c.bg }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#0D1B3D'
          }}>{avatarInitial}</div>
          <div>
            <div style={{ color: 'white', fontSize: 17, fontWeight: 800 }}>{userInfo.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{userInfo.email}</div>
            <span className="badge badge-gold" style={{ marginTop: 4 }}>{roleLabel}</span>
          </div>
          <button className="btn" onClick={() => onNavigate('profile')} style={{ marginLeft: 'auto', width: 36, height: 36, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>

        {/* Business info */}
        <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 0 }}>
          {[['Store', businessInfo.name], ['Branch', businessInfo.branch], ['Shift', 'Morning']].map(([k, v], i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none', padding: '0 8px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: i === 2 ? '#D4AF37' : 'white', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {isOfflineSnapshot && (
          <div role="status" style={{ background: c.cardAlt, color: c.muted, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
            Offline overview{snapshotUpdatedAt ? ` · saved ${new Date(snapshotUpdatedAt).toLocaleString()}` : ''}. Only previously saved details are available.
          </div>
        )}
        {overviewError && (
          <div role="alert" style={{ background: c.errorBg, color: '#D32F2F', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
            {overviewError}
          </div>
        )}
        {menuItems.map((section) => (
          <div key={section.section} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{section.section}</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {section.items.map((item, i) => (
                <button key={i} className="btn" onClick={() => onNavigate(item.screen)} style={{
                  width: '100%', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  border: 'none', background: 'none',
                  borderBottom: i < section.items.length - 1 ? c.divider : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: c.tint(item.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: c.text }}>{item.label}</div>
                  {item.screen === 'notifications' && unreadNotifications > 0 && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#D32F2F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>{unreadNotifications}</div>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.faint} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button className="btn" onClick={onLogout} style={{
          width: '100%', padding: '16px',
          background: c.isDark ? 'rgba(211,47,47,0.15)' : '#FFF5F5',
          border: `1px solid ${c.isDark ? 'rgba(211,47,47,0.3)' : '#FFCDD2'}`,
          borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer', fontFamily: 'inherit'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#D32F2F' }}>Logout</span>
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, padding: '0 20px 8px' }}>
          <div style={{ fontSize: 12, color: c.faint }}>MobiDuka POS v2.4.1</div>
          <div style={{ fontSize: 11, color: c.faint, marginTop: 2 }}>© 2026 Degem Ventures · Kenya</div>
        </div>
      </div>
    </div>
  )
}
