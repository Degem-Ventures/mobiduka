import { useState } from 'react'
import { useColors } from '../utils/theme'

const shiftTypes = [
  { id: 'morning',   label: 'Morning',   hours: '6:00 AM – 2:00 PM',   icon: '🌅', color: '#F57C00' },
  { id: 'afternoon', label: 'Afternoon', hours: '2:00 PM – 10:00 PM',  icon: '☀️', color: '#0288D1' },
  { id: 'night',     label: 'Night',     hours: '10:00 PM – 6:00 AM',  icon: '🌙', color: '#5E35B1' },
]

const staffList = [
  { id: 1, name: 'Grace Wanjiku',  role: 'Cashier',    initials: 'GW' },
  { id: 2, name: 'Brian Omondi',   role: 'Cashier',    initials: 'BO' },
  { id: 3, name: 'Fatuma Hassan',  role: 'Supervisor', initials: 'FH' },
  { id: 4, name: 'Peter Kamau',    role: 'Cashier',    initials: 'PK' },
  { id: 5, name: 'Aisha Mwangi',   role: 'Cashier',    initials: 'AM' },
]

interface ShiftRecord {
  id: number; cashier: string; initials: string
  type: string; label: string; icon: string; color: string
  start: string; end: string | null; sales: number; amount: number; date: string
}

const pastShifts: ShiftRecord[] = [
  { id: 1, cashier: 'Grace Wanjiku',  initials: 'GW', type: 'morning',   label: 'Morning',   icon: '🌅', color: '#F57C00', start: '06:02 AM', end: '02:05 PM', sales: 34, amount: 28400,  date: 'Today' },
  { id: 2, cashier: 'Brian Omondi',   initials: 'BO', type: 'afternoon', label: 'Afternoon', icon: '☀️', color: '#0288D1', start: '02:00 PM', end: '09:58 PM', sales: 21, amount: 19750,  date: 'Today' },
  { id: 3, cashier: 'Fatuma Hassan',  initials: 'FH', type: 'morning',   label: 'Morning',   icon: '🌅', color: '#F57C00', start: '06:00 AM', end: '02:00 PM', sales: 41, amount: 35200,  date: 'Yesterday' },
  { id: 4, cashier: 'Peter Kamau',    initials: 'PK', type: 'afternoon', label: 'Afternoon', icon: '☀️', color: '#0288D1', start: '02:00 PM', end: '09:55 PM', sales: 18, amount: 14800,  date: 'Yesterday' },
  { id: 5, cashier: 'Aisha Mwangi',   initials: 'AM', type: 'night',     label: 'Night',     icon: '🌙', color: '#5E35B1', start: '10:00 PM', end: '06:02 AM', sales: 9,  amount: 7300,   date: '7 Sep' },
]

interface Props { onNavigate: (s: string) => void }

export default function ShiftsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [view, setView] = useState<'list' | 'start' | 'active'>('list')
  const [selectedShift, setSelectedShift] = useState('morning')
  const [selectedStaff, setSelectedStaff] = useState(1)
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null)

  const startShift = () => {
    const member = staffList.find(s => s.id === selectedStaff)!
    const sType = shiftTypes.find(s => s.id === selectedShift)!
    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setActiveShift({
      id: Date.now(), cashier: member.name, initials: member.initials,
      type: sType.id, label: sType.label, icon: sType.icon, color: sType.color,
      start: timeStr, end: null, sales: 0, amount: 0, date: 'Today',
    })
    setView('active')
  }

  const endShift = () => {
    setActiveShift(null)
    setView('list')
  }

  // ── Start Shift ─────────────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Start New Shift</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>

          <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Shift Type</div>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            {shiftTypes.map((s, i, arr) => (
              <button key={s.id} className="btn" onClick={() => setSelectedShift(s.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', border: 'none',
                borderBottom: i < arr.length - 1 ? c.divider : 'none',
                background: selectedShift === s.id ? (c.isDark ? 'rgba(18,58,143,0.2)' : 'rgba(18,58,143,0.05)') : 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(s.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.label} Shift</div>
                  <div style={{ fontSize: 12, color: c.muted }}>{s.hours}</div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${selectedShift === s.id ? '#123A8F' : c.faint}`,
                  background: selectedShift === s.id ? '#123A8F' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selectedShift === s.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                </div>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Assign Cashier</div>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            {staffList.map((member, i, arr) => (
              <button key={member.id} className="btn" onClick={() => setSelectedStaff(member.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', border: 'none',
                borderBottom: i < arr.length - 1 ? c.divider : 'none',
                background: selectedStaff === member.id ? (c.isDark ? 'rgba(18,58,143,0.2)' : 'rgba(18,58,143,0.05)') : 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {member.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{member.role}</div>
                </div>
                {selectedStaff === member.id && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.5" strokeLinecap="round"><polyline points="20,6 9,17 4,12" /></svg>
                )}
              </button>
            ))}
          </div>

          <button className="btn" onClick={startShift} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(46,125,50,0.35)' }}>
            ▶ Start Shift Now
          </button>
        </div>
      </div>
    )
  }

  // ── Active Shift ─────────────────────────────────────────────────────────
  if (view === 'active' && activeShift) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Active Shift</div>
            <span style={{ marginLeft: 'auto', background: 'rgba(46,125,50,0.3)', border: '1px solid rgba(46,125,50,0.5)', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#A5D6A7' }}>● LIVE</span>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {activeShift.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{activeShift.cashier}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ background: c.tint(activeShift.color), color: activeShift.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>
                    {activeShift.icon} {activeShift.label} Shift
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Started', value: activeShift.start },
                { label: 'Sales', value: String(activeShift.sales) },
                { label: 'Revenue', value: `KSh ${activeShift.amount.toLocaleString()}` },
              ].map(stat => (
                <div key={stat.label} style={{ background: c.cardAlt, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: c.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{stat.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.3)' : '#C8E6C9'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32', marginBottom: 4 }}>🟢 Shift in progress</div>
            <div style={{ fontSize: 12, color: c.muted }}>All POS sales during this shift are being tracked and attributed to {activeShift.cashier.split(' ')[0]}.</div>
          </div>

          <button className="btn" onClick={endShift} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(211,47,47,0.35)' }}>
            ■ End Shift
          </button>
        </div>
      </div>
    )
  }

  // ── Shift List ───────────────────────────────────────────────────────────
  const grouped = pastShifts.reduce<Record<string, ShiftRecord[]>>((acc, s) => {
    acc[s.date] = acc[s.date] ? [...acc[s.date], s] : [s]
    return acc
  }, {})

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('employees')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Shift Management</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{pastShifts.length} shifts logged this week</div>
          </div>
          <button className="btn" onClick={() => setView('start')} style={{ marginLeft: 'auto', background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#0D1B3D', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Start
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {/* No active shift notice */}
        {!activeShift && (
          <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>⏰</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#FFD54F' : '#5D4037' }}>No Active Shift</div>
              <div style={{ fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63', marginTop: 2 }}>Start a shift to track cashier performance</div>
            </div>
            <button className="btn" onClick={() => setView('start')} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#0D1B3D', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              Start
            </button>
          </div>
        )}

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Today Shifts', value: '2' },
            { label: 'Today Sales', value: '55' },
            { label: 'Today Revenue', value: 'KSh 48.2k' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: c.muted, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Grouped shift history */}
        {Object.entries(grouped).map(([date, shifts]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{date}</div>
            {shifts.map(s => (
              <div key={s.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {s.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{s.cashier}</div>
                      <span style={{ background: c.tint(s.color), color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>
                        {s.icon} {s.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: c.muted }}>{s.start} → {s.end} · {s.sales} sales</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>KSh {s.amount.toLocaleString()}</div>
                    <span className="badge badge-success" style={{ fontSize: 10, marginTop: 4 }}>Closed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
