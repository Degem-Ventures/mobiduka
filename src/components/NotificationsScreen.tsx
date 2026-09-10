import { useState } from 'react'

const notifications = [
  { id: 1, type: 'critical', title: 'Critical Stock Alert', body: 'Panadol 500mg has only 3 units remaining. Reorder level is 50 units.', time: '14:30', date: 'Today', read: false, icon: '🔴' },
  { id: 2, type: 'warning', title: 'Low Stock Warning', body: 'Royco 75g is running low (5 units). Consider placing a purchase order.', time: '13:55', date: 'Today', read: false, icon: '⚠️' },
  { id: 3, type: 'success', title: 'Daily Sales Target Achieved', body: "Congratulations! Today's sales of KSh 84,250 exceeded the daily target of KSh 70,000.", time: '13:00', date: 'Today', read: false, icon: '🎯' },
  { id: 4, type: 'info', title: 'New Purchase Order Received', body: 'PO-2026-083 from Bidco Africa has been marked as delivered. 4 items received.', time: '11:20', date: 'Today', read: true, icon: '📦' },
  { id: 5, type: 'warning', title: 'Credit Account Overdue', body: 'Grace Achieng\'s credit balance of KSh 9,600 is overdue by 5 days.', time: '09:00', date: 'Today', read: true, icon: '💳' },
  { id: 6, type: 'info', title: 'Backup Completed', body: 'Your data has been successfully backed up to the cloud. All records are safe.', time: '06:00', date: 'Today', read: true, icon: '☁️' },
  { id: 7, type: 'success', title: 'New Customer Registered', body: 'Grace Achieng has been added as a new customer to your database.', time: '15:30', date: 'Yesterday', read: true, icon: '👤' },
  { id: 8, type: 'info', title: 'Monthly Report Available', body: 'Your June 2026 monthly sales and profit report is ready to view.', time: '07:00', date: 'Yesterday', read: true, icon: '📊' },
  { id: 9, type: 'warning', title: 'Low Cash in Till', body: 'Cash in till is below KSh 20,000. Consider topping up or depositing excess.', time: '16:00', date: '6 Jul', read: true, icon: '💵' },
  { id: 10, type: 'critical', title: 'Expired Product Alert', body: 'Dawa Product Batch #DW2209 is approaching expiry in 7 days. Check pharmacy stock.', time: '10:00', date: '6 Jul', read: true, icon: '💊' },
]

const typeColors: Record<string, { bg: string; border: string; dot: string }> = {
  critical: { bg: '#FFF5F5', border: '#FFCDD2', dot: '#D32F2F' },
  warning: { bg: '#FFF8E1', border: '#FFE082', dot: '#F9A825' },
  success: { bg: '#F1F8E9', border: '#C5E1A5', dot: '#2E7D32' },
  info: { bg: '#E3F2FD', border: '#90CAF9', dot: '#0288D1' },
}

interface Props { onNavigate: (s: string) => void }

export default function NotificationsScreen({ onNavigate }: Props) {
  const [items, setItems] = useState(notifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const unreadCount = items.filter(n => !n.read).length
  const markAllRead = () => setItems(i => i.map(n => ({ ...n, read: true })))
  const markRead = (id: number) => setItems(i => i.map(n => n.id === id ? { ...n, read: true } : n))

  const today = items.filter(n => n.date === 'Today' && (filter === 'all' || !n.read))
  const yesterday = items.filter(n => n.date === 'Yesterday' && (filter === 'all' || !n.read))
  const older = items.filter(n => n.date !== 'Today' && n.date !== 'Yesterday' && (filter === 'all' || !n.read))

  const Section = ({ title, data }: { title: string; data: typeof items }) => data.length === 0 ? null : (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{title}</div>
      {data.map(n => (
        <button key={n.id} className="btn" onClick={() => markRead(n.id)} style={{
          width: '100%', padding: '14px 16px', marginBottom: 8, textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: n.read ? 'white' : typeColors[n.type].bg,
          borderRadius: 14, borderLeft: `3px solid ${n.read ? 'transparent' : typeColors[n.type].dot}`,
          boxShadow: n.read ? '0 1px 4px rgba(0,0,0,0.06)' : `0 2px 8px rgba(0,0,0,0.1), 0 0 0 1px ${typeColors[n.type].border}`
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: n.read ? '#F5F7FA' : `${typeColors[n.type].bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, color: '#0D1B3D', flex: 1 }}>{n.title}</div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[n.type].dot, flexShrink: 0, marginTop: 4 }} />}
              </div>
              <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 3, lineHeight: 1.5 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: '#B0BAD3', marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
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
        {today.length === 0 && yesterday.length === 0 && older.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#B0BAD3' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7A99' }}>No notifications</div>
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
