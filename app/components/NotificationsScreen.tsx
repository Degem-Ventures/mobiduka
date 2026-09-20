import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type NotificationItem = { id: string; type: string; title: string; body: string; createdAt: string; read: boolean; icon: string }
type DisplayNotification = NotificationItem & { date: string; time: string }

const typeColors: Record<string, { bg: string; border: string; dot: string }> = {
  critical: { bg: '#FFF5F5', border: '#FFCDD2', dot: '#D32F2F' },
  warning: { bg: '#FFF8E1', border: '#FFE082', dot: '#F9A825' },
  success: { bg: '#F1F8E9', border: '#C5E1A5', dot: '#2E7D32' },
  info: { bg: '#E3F2FD', border: '#90CAF9', dot: '#0288D1' },
}

interface Props { onNavigate: (s: string) => void }

export default function NotificationsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setDataError('Please sign in to load notifications.'); return }
    apiFetch<{ notifications: NotificationItem[] }>(`/api/notifications?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(response => setItems(response.notifications))
      .catch(reason => setDataError(reason instanceof Error ? reason.message : 'Unable to load notifications.'))
  }, [])

  const unreadCount = items.filter(n => !n.read).length
  const markAllRead = async () => {
    const session = getClientSession()
    if (!session) return
    try {
      await apiFetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, markAllRead: true }) })
      setItems(i => i.map(n => ({ ...n, read: true })))
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to mark notifications as read.')
    }
  }
  const markRead = async (id: string) => {
    const session = getClientSession()
    if (!session) return
    try {
      await apiFetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, id }) })
      setItems(i => i.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to mark notification as read.')
    }
  }
  const deleteNotification = async (id: string) => {
    const session = getClientSession()
    if (!session) return
    try {
      await apiFetch('/api/notifications', { method: 'DELETE', body: JSON.stringify({ businessId: session.user.businessId, id }) })
      setItems(i => i.filter(n => n.id !== id))
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to delete notification.')
    }
  }

  const formatDate = (createdAt: string) => {
    const date = new Date(createdAt)
    const today = new Date()
    const todayKey = today.toLocaleDateString()
    const dateKey = date.toLocaleDateString()
    return dateKey === todayKey ? 'Today' : dateKey === new Date(today.getTime() - 86400000).toLocaleDateString() ? 'Yesterday' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const withDisplayFields: DisplayNotification[] = items.map(item => ({ ...item, date: formatDate(item.createdAt), time: new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }))

  const today = withDisplayFields.filter(n => n.date === 'Today' && (filter === 'all' || !n.read))
  const yesterday = withDisplayFields.filter(n => n.date === 'Yesterday' && (filter === 'all' || !n.read))
  const older = withDisplayFields.filter(n => n.date !== 'Today' && n.date !== 'Yesterday' && (filter === 'all' || !n.read))

  const Section = ({ title, data }: { title: string; data: DisplayNotification[] }) => data.length === 0 ? null : (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{title}</div>
      {data.map(n => (
        <button key={n.id} className="btn" onClick={() => markRead(n.id)} style={{
          width: '100%', padding: '14px 16px', marginBottom: 8, textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: n.read ? c.card : typeColors[n.type].bg,
          borderRadius: 14, borderLeft: `3px solid ${n.read ? 'transparent' : typeColors[n.type].dot}`,
          boxShadow: n.read ? '0 1px 4px rgba(0,0,0,0.06)' : `0 2px 8px rgba(0,0,0,0.1), 0 0 0 1px ${typeColors[n.type].border}`
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: n.read ? c.cardAlt : `${typeColors[n.type].bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, color: c.text, flex: 1 }}>{n.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[n.type].dot, marginTop: 4 }} />}
                  {n.read && <span role="button" tabIndex={0} aria-label="Delete notification" onClick={event => { event.stopPropagation(); void deleteNotification(n.id) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); void deleteNotification(n.id) } }} style={{ color: c.faint, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 3, lineHeight: 1.5 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: c.faint, marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Notifications</div>
              {unreadCount > 0 && <div style={{ background: '#D32F2F', borderRadius: 100, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'white' }}>{unreadCount} new</div>}
            </div>
          </div>
          {unreadCount > 0 && (
            <button className="btn" onClick={markAllRead} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Mark all read
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', 'All'], ['unread', 'Unread']].map(([k, l]) => (
            <button key={k} className="btn" onClick={() => setFilter(k as 'all' | 'unread')} style={{ padding: '6px 16px', borderRadius: 100, border: 'none', background: filter === k ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: filter === k ? '#0D1B3D' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {dataError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        {today.length === 0 && yesterday.length === 0 && older.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: c.faint }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: c.muted }}>No notifications</div>
          </div>
        ) : (
          <>
            <Section title="Today" data={today} />
            <Section title="Yesterday" data={yesterday} />
            <Section title="Earlier" data={older} />
          </>
        )}
      </div>
    </div>
  )
}
