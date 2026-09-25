import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'


type ShiftType = { id: string; code: string; name: string; scheduledStart: string; scheduledEnd: string; icon: string | null; color: string | null }

interface ShiftRecord {
  id: string; cashierId: string | null; cashier: string; initials: string
  type: string; label: string; icon: string; color: string
  start: string; end: string | null; openedAt: string; sales: number; amount: number; date: string
}

interface Props { onNavigate: (s: string) => void }

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const isShiftTypeAvailableNow = (shiftType: ShiftType, now = new Date()) => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = timeToMinutes(shiftType.scheduledStart)
  const endMinutes = timeToMinutes(shiftType.scheduledEnd)

  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export default function ShiftsScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [view, setView] = useState<'list' | 'start' | 'active'>('list')
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [selectedShift, setSelectedShift] = useState('')
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string; initials: string }>>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [pastShifts, setPastShifts] = useState<ShiftRecord[]>([])
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null)
  const [dataError, setDataError] = useState('')

  const loadShiftData = async () => {
    if (!session) { setDataError('Please sign in to load shifts.'); return }
    try {
      const [employeeResponse, shiftResponse, shiftTypeResponse] = await Promise.all([
        apiFetch<{ employees: Array<{ id: string; fullName: string; role: string }> }>(`/api/employees?businessId=${encodeURIComponent(session.user.businessId)}`),
        apiFetch<{ sessions: Array<{ id: string; shiftType: string; shift: ShiftType | null; openedAt: string; closedAt: string | null; sales: number; amount: number; cashier: { id: string; fullName: string; role: { name: string } | null } | null }> }>(`/api/cash/session?businessId=${encodeURIComponent(session.user.businessId)}`),
        apiFetch<{ shiftTypes: ShiftType[] }>(`/api/shift-types?businessId=${encodeURIComponent(session.user.businessId)}`),
      ])
      const orderedShiftTypes = [...(shiftTypeResponse.shiftTypes ?? [])].sort((left, right) => {
        const startDifference = timeToMinutes(left.scheduledStart) - timeToMinutes(right.scheduledStart)
        if (startDifference !== 0) return startDifference
        const endDifference = timeToMinutes(left.scheduledEnd) - timeToMinutes(right.scheduledEnd)
        return endDifference !== 0 ? endDifference : left.name.localeCompare(right.name)
      })
      setShiftTypes(orderedShiftTypes)
      const availableShift = orderedShiftTypes.find(shiftType => isShiftTypeAvailableNow(shiftType))
      if (availableShift) setSelectedShift(availableShift.id)
      const operationalSessions = shiftResponse.sessions.filter(item => ['CASHIER', 'SUPERVISOR'].includes(item.cashier?.role?.name?.toUpperCase() ?? ''))
      const activeCashierIds = new Set(operationalSessions.filter(item => !item.closedAt && item.cashier?.id).map(item => item.cashier?.id as string))
      const staff = employeeResponse.employees.filter(employee => (employee.role === 'CASHIER' || employee.role === 'SUPERVISOR') && !activeCashierIds.has(employee.id)).map(employee => ({ id: employee.id, name: employee.fullName, role: employee.role, initials: employee.fullName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase() }))
      setStaffList(staff)
      if (!selectedStaff && staff[0]) setSelectedStaff(staff[0].id)
      const mappedSessions = operationalSessions.map(item => {
        const type = item.shift ?? shiftTypeResponse.shiftTypes.find(shift => shift.code === item.shiftType) ?? shiftTypeResponse.shiftTypes[0]
        return { id: item.id, cashierId: item.cashier?.id ?? null, cashier: item.cashier?.fullName ?? 'Unknown', initials: item.cashier?.fullName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase() ?? '??', type: type?.code ?? item.shiftType, label: type?.name ?? item.shiftType, icon: type?.icon ?? '🕐', color: type?.color ?? '#123A8F', start: new Date(item.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), end: item.closedAt ? new Date(item.closedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null, openedAt: item.openedAt, sales: item.sales, amount: Number(item.amount), date: new Date(item.openedAt).toLocaleDateString() }
      }).sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime())
      setPastShifts(mappedSessions)
      const active = operationalSessions.find(item => !item.closedAt)
      if (active) setActiveShift(mappedSessions.find(shift => shift.id === active.id) ?? null)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load shifts.') }
  }

  useEffect(() => { void loadShiftData() }, [session?.user.businessId])

  const startShift = async () => {
    if (!session || !selectedStaff) return
    const member = staffList.find(s => s.id === selectedStaff)
    const sType = shiftTypes.find(s => s.id === selectedShift)
    if (!sType || !isShiftTypeAvailableNow(sType)) {
      setDataError('Only the shift type scheduled for the current time can be started.')
      return
    }
    try {
      await apiFetch('/api/cash/session', { method: 'POST', body: JSON.stringify({ action: 'OPEN', businessId: session.user.businessId, userId: member?.id, openingCash: 0, shiftTypeId: sType.id }) })
      window.dispatchEvent(new Event('mobiduka:shift-changed'))
      await loadShiftData()
      setView('active')
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to start shift.') }
  }

  const openStartView = async () => {
    await loadShiftData()
    setView('start')
  }

  const endShift = async () => {
    if (!session || !activeShift) return
    try {
      await apiFetch('/api/cash/session', { method: 'POST', body: JSON.stringify({ action: 'CLOSE', businessId: session.user.businessId, userId: activeShift.cashierId ?? session.user.id, sessionId: activeShift.id, closingCash: 0 }) })
      window.dispatchEvent(new Event('mobiduka:shift-changed'))
      await loadShiftData()
      setActiveShift(null)
      setView('list')
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to end shift.') }
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
            {shiftTypes.map((s, i, arr) => {
              const availableNow = isShiftTypeAvailableNow(s)
              return (
              <button key={s.id} className="btn" disabled={!availableNow} onClick={() => { if (availableNow) setSelectedShift(s.id) }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', border: 'none',
                borderBottom: i < arr.length - 1 ? c.divider : 'none',
                background: selectedShift === s.id ? (c.isDark ? 'rgba(18,58,143,0.2)' : 'rgba(18,58,143,0.05)') : 'none',
                cursor: availableNow ? 'pointer' : 'not-allowed', opacity: availableNow ? 1 : 0.45, fontFamily: 'inherit', textAlign: 'left',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(s.color ?? '#123A8F'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon ?? '🕐'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.name} Shift</div>
                  <div style={{ fontSize: 12, color: c.muted }}>{s.scheduledStart} – {s.scheduledEnd}</div>
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
              )
            })}
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
        <style>{`@keyframes shift-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.38; } } .live-shift-badge { animation: shift-live-pulse 1.2s ease-in-out infinite; }`}</style>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Active Shift</div>
            <span className="live-shift-badge" style={{ marginLeft: 'auto', background: 'rgba(46,125,50,0.3)', border: '1px solid rgba(46,125,50,0.5)', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#A5D6A7' }}>● LIVE</span>
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
  const todayKey = new Date().toLocaleDateString()
  const todayShifts = pastShifts.filter(shift => shift.date === todayKey)
  const todaySales = todayShifts.reduce((sum, shift) => sum + shift.sales, 0)
  const todayRevenue = todayShifts.reduce((sum, shift) => sum + shift.amount, 0)

  return (
    <div className="screen" style={{ background: c.bg }}>
      <style>{`@keyframes shift-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.38; } } .live-shift-badge { animation: shift-live-pulse 1.2s ease-in-out infinite; }`}</style>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('employees')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Shift Management</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{pastShifts.length} shifts logged this week</div>
          </div>
          <button className="btn" onClick={() => void openStartView()} style={{ marginLeft: 'auto', background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#0D1B3D', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Start
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {dataError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        {/* No active shift notice */}
        {!activeShift && (
          <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>⏰</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.isDark ? '#FFD54F' : '#5D4037' }}>No Active Shift</div>
              <div style={{ fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63', marginTop: 2 }}>Start a shift to track cashier performance</div>
            </div>
            <button className="btn" onClick={() => void openStartView()} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#0D1B3D', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              Start
            </button>
          </div>
        )}

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Today Shifts', value: String(todayShifts.length) },
            { label: 'Today Sales', value: String(todaySales) },
            { label: 'Today Revenue', value: `KSh ${todayRevenue.toLocaleString()}` },
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
              <div key={s.id} className="card" onClick={() => { if (!s.end) { setActiveShift(s); setView('active') } }} style={{ padding: '14px 16px', marginBottom: 10, cursor: s.end ? 'default' : 'pointer' }}>
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
                    <span className={s.end ? 'badge badge-success' : 'badge live-shift-badge'} style={{ fontSize: 10, marginTop: 4, color: s.end ? undefined : '#2E7D32', background: s.end ? undefined : '#E8F5E9' }}>{s.end ? 'Closed' : '● In Progress'}</span>
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
