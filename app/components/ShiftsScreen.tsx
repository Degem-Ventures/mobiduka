import { type FormEvent, useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'
import { useAutoDismissMessage } from '../../lib/use-auto-dismiss-message'

type ShiftType = { id: string; code: string; name: string; scheduledStart: string; scheduledEnd: string; icon: string | null; color: string | null }
type ShiftIcon = { value: string; label: string }

const SHIFT_TYPE_ICONS: ShiftIcon[] = [
  { value: '🌅', label: 'Sunrise' },
  { value: '☀️', label: 'Sun' },
  { value: '🌤️', label: 'Partly sunny' },
  { value: '🌇', label: 'Sunset' },
  { value: '🌙', label: 'Moon' },
  { value: '🌃', label: 'Night city' },
  { value: '🕐', label: 'Clock' },
  { value: '⏰', label: 'Alarm clock' },
  { value: '☕', label: 'Coffee' },
  { value: '📅', label: 'Calendar' },
]

interface ShiftRecord {
  id: string; cashierId: string | null; cashier: string; initials: string
  type: string; label: string; icon: string; color: string
  start: string; end: string | null; openedAt: string; closedAt: string | null; sales: number; amount: number; date: string
}

interface Props { onNavigate: (s: string) => void; openActiveShift?: boolean }

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const shiftDuration = (shiftType: ShiftType) => {
  const start = timeToMinutes(shiftType.scheduledStart)
  const end = timeToMinutes(shiftType.scheduledEnd)
  return (end - start + 1440) % 1440 || 1440
}

const shiftTimeRanges = (shiftType: ShiftType) => {
  const start = timeToMinutes(shiftType.scheduledStart)
  const end = timeToMinutes(shiftType.scheduledEnd)
  if (start === end) return [[0, 1440]]
  if (start < end) return [[start, end]]
  return [[start, 1440], [0, end]]
}

const shiftTypesOverlap = (left: ShiftType, right: ShiftType) =>
  shiftTimeRanges(left).some(([leftStart, leftEnd]) =>
    shiftTimeRanges(right).some(([rightStart, rightEnd]) =>
      leftStart < rightEnd && rightStart < leftEnd
    )
  )

const orderShiftTypes = (shiftTypes: ShiftType[]) => {
  const standardShiftOrder = new Map([
    ['morning', 0],
    ['afternoon', 1],
    ['night', 2],
  ])
  const overlapsAnother = new Map(
    shiftTypes.map(type => [
      type.id,
      shiftTypes.some(other => other.id !== type.id && shiftTypesOverlap(type, other)),
    ])
  )

  return [...shiftTypes].sort((left, right) => {
    const leftStandardOrder = standardShiftOrder.get(left.code)
    const rightStandardOrder = standardShiftOrder.get(right.code)
    if (leftStandardOrder !== undefined || rightStandardOrder !== undefined) {
      if (leftStandardOrder === undefined) return 1
      if (rightStandardOrder === undefined) return -1
      return leftStandardOrder - rightStandardOrder
    }

    const overlapOrder = Number(overlapsAnother.get(left.id)) - Number(overlapsAnother.get(right.id))
    if (overlapOrder !== 0) return overlapOrder
    if (overlapsAnother.get(left.id)) {
      const durationOrder = shiftDuration(left) - shiftDuration(right)
      if (durationOrder !== 0) return durationOrder
    }
    const startDifference = timeToMinutes(left.scheduledStart) - timeToMinutes(right.scheduledStart)
    if (startDifference !== 0) return startDifference
    const endDifference = timeToMinutes(left.scheduledEnd) - timeToMinutes(right.scheduledEnd)
    return endDifference !== 0 ? endDifference : left.name.localeCompare(right.name)
  })
}

const formatShiftTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const dateKey = (value: Date) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const formatDateLabel = (value: Date) => value.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
const formatTimeLabel = (value: Date) => value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const formatShiftDuration = (openedAt: string, closedAt: string) => {
  const minutes = Math.max(0, Math.floor((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0 && remainingMinutes === 0) return '<1m'
  return `${hours}h ${remainingMinutes}m`
}

const formatElapsedShiftDuration = (openedAt: string, now: number) => {
  const minutes = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0 && remainingMinutes === 0) return '<1m'
  return `${hours}h ${remainingMinutes}m`
}

const hasExceededShiftDuration = (openedAt: string, now: number) =>
  now - new Date(openedAt).getTime() > 8 * 60 * 60 * 1000

const formatShiftRange = (openedAt: string, closedAt: string | null) => {
  const start = new Date(openedAt)
  const end = closedAt ? new Date(closedAt) : null

  if (!end) {
    const sameDay = dateKey(start) === dateKey(new Date())
    return sameDay ? `Started ${formatTimeLabel(start)}` : `Started ${formatDateLabel(start)} · ${formatTimeLabel(start)}`
  }

  const sameDay = dateKey(start) === dateKey(end)
  if (sameDay) {
    return `${formatTimeLabel(start)} → ${formatTimeLabel(end)}`
  }

  return `${formatDateLabel(start)} ${formatTimeLabel(start)} → ${formatDateLabel(end)} ${formatTimeLabel(end)}`
}

const createShiftCode = (name: string, existingCodes: Set<string>) => {
  const base = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shift'
  let code = base
  let suffix = 2
  while (existingCodes.has(code)) {
    code = `${base}-${suffix}`
    suffix += 1
  }
  return code
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

export default function ShiftsScreen({ onNavigate, openActiveShift = false }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [view, setView] = useState<'list' | 'start' | 'active' | 'types'>('list')
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [selectedShift, setSelectedShift] = useState('')
  const [newShiftName, setNewShiftName] = useState('')
  const [newShiftIcon, setNewShiftIcon] = useState('🕐')
  const [newShiftStart, setNewShiftStart] = useState('08:00')
  const [newShiftEnd, setNewShiftEnd] = useState('17:00')
  const [editingShiftTypeId, setEditingShiftTypeId] = useState<string | null>(null)
  const [shiftTypeDraft, setShiftTypeDraft] = useState({ name: '', icon: '🕐', start: '', end: '' })
  const [savingShiftType, setSavingShiftType] = useState(false)
  const [savingShiftTypeEdit, setSavingShiftTypeEdit] = useState(false)
  const [deletingShiftTypeId, setDeletingShiftTypeId] = useState<string | null>(null)
  const [shiftTypeMessage, setShiftTypeMessage] = useState('')
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string; initials: string }>>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [pastShifts, setPastShifts] = useState<ShiftRecord[]>([])
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null)
  const [dataError, setDataError] = useAutoDismissMessage()
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!shiftTypeMessage) return
    const timeout = window.setTimeout(() => setShiftTypeMessage(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [shiftTypeMessage])

  const renderShiftIconPicker = (value: string, onChange: (icon: string) => void, idPrefix: string) => (
    <fieldset style={{ border: 0, margin: '0 0 12px', padding: 0 }}>
      <legend style={{ fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 6 }}>Choose an icon</legend>
      <div role="group" aria-label="Shift icon" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 7 }}>
        {SHIFT_TYPE_ICONS.map(icon => {
          const selected = value === icon.value
          return (
            <button
              key={icon.label}
              id={`${idPrefix}-${icon.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="btn"
              type="button"
              aria-pressed={selected}
              aria-label={`Select ${icon.label} icon`}
              title={icon.label}
              onClick={() => onChange(icon.value)}
              style={{
                height: 40,
                border: `1px solid ${selected ? '#123A8F' : c.border}`,
                borderRadius: 10,
                background: selected ? c.infoBg : c.cardAlt,
                boxShadow: selected ? '0 0 0 1px #123A8F inset' : 'none',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              {icon.value}
            </button>
          )
        })}
      </div>
    </fieldset>
  )

  const loadShiftData = async () => {
    if (!session) { setDataError('Please sign in to load shifts.'); return }
    try {
      const [employeeResponse, shiftResponse, shiftTypeResponse] = await Promise.all([
        apiFetch<{ employees: Array<{ id: string; fullName: string; role: string; isActive: boolean }> }>(`/api/employees?businessId=${encodeURIComponent(session.user.businessId)}`),
        apiFetch<{ sessions: Array<{ id: string; shiftType: string; shift: ShiftType | null; openedAt: string; closedAt: string | null; sales: number; amount: number; cashier: { id: string; fullName: string; role: { name: string } | null } | null }> }>(`/api/cash/session?businessId=${encodeURIComponent(session.user.businessId)}`),
        apiFetch<{ shiftTypes: ShiftType[] }>(`/api/shift-types?businessId=${encodeURIComponent(session.user.businessId)}`),
      ])
      const orderedShiftTypes = orderShiftTypes(shiftTypeResponse.shiftTypes ?? [])
      setShiftTypes(orderedShiftTypes)
      const availableShift = orderedShiftTypes.find(shiftType => isShiftTypeAvailableNow(shiftType))
      if (availableShift) setSelectedShift(availableShift.id)
      const operationalSessions = shiftResponse.sessions.filter(item => ['CASHIER', 'SUPERVISOR'].includes(item.cashier?.role?.name?.toUpperCase() ?? ''))
      const activeCashierIds = new Set(operationalSessions.filter(item => !item.closedAt && item.cashier?.id).map(item => item.cashier?.id as string))
      const staff = employeeResponse.employees
        .filter(employee => {
          const role = employee.role.trim().toUpperCase()
          return employee.isActive && (role === 'CASHIER' || role === 'SUPERVISOR') && !activeCashierIds.has(employee.id)
        })
        .map(employee => ({ id: employee.id, name: employee.fullName, role: employee.role, initials: employee.fullName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase() }))
      setStaffList(staff)
      if (!selectedStaff && staff[0]) setSelectedStaff(staff[0].id)
      const mappedSessions = operationalSessions.map(item => {
        const type = item.shift ?? shiftTypeResponse.shiftTypes.find(shift => shift.code === item.shiftType) ?? shiftTypeResponse.shiftTypes[0]
        const startDate = new Date(item.openedAt)
        const endDate = item.closedAt ? new Date(item.closedAt) : null
        return {
          id: item.id,
          cashierId: item.cashier?.id ?? null,
          cashier: item.cashier?.fullName ?? 'Unknown',
          initials: item.cashier?.fullName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase() ?? '??',
          type: type?.code ?? item.shiftType,
          label: type?.name ?? item.shiftType,
          icon: type?.icon ?? '🕐',
          color: type?.color ?? '#123A8F',
          start: formatTimeLabel(startDate),
          end: endDate ? formatTimeLabel(endDate) : null,
          startDate: formatDateLabel(startDate),
          endDate: endDate ? formatDateLabel(endDate) : null,
          openedAt: item.openedAt,
          closedAt: item.closedAt,
          sales: item.sales,
          amount: Number(item.amount),
          date: new Date(item.openedAt).toLocaleDateString(),
        }
      }).sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime())
      setPastShifts(mappedSessions)
      const active = operationalSessions.find(item => !item.closedAt)
      if (active) {
        setActiveShift(mappedSessions.find(shift => shift.id === active.id) ?? null)
        if (openActiveShift) setView('active')
      }
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load shifts.') }
  }

  useEffect(() => { void loadShiftData() }, [session?.user.businessId, openActiveShift])

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

  const saveShiftType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) {
      setDataError('Please sign in to create shift types.')
      return
    }

    const name = newShiftName.trim()
    if (!name || !newShiftStart || !newShiftEnd) {
      setDataError('Enter a shift name, start time, and end time.')
      return
    }

    setSavingShiftType(true)
    setDataError('')
    setShiftTypeMessage('')
    try {
      const code = createShiftCode(name, new Set(shiftTypes.map(type => type.code)))
      const response = await apiFetch<{ shiftType: ShiftType }>('/api/shift-types', {
        method: 'POST',
        body: JSON.stringify({
          businessId: session.user.businessId,
          code,
          name,
          scheduledStart: newShiftStart,
          scheduledEnd: newShiftEnd,
          icon: newShiftIcon,
          color: '#123A8F',
        }),
      })
      setShiftTypes(types => orderShiftTypes([...types, response.shiftType]))
      setNewShiftName('')
      setNewShiftIcon('🕐')
      setNewShiftStart('08:00')
      setNewShiftEnd('17:00')
      setShiftTypeMessage(`${response.shiftType.name} shift type created and is ready to use.`)
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to create shift type.')
    } finally {
      setSavingShiftType(false)
    }
  }

  const beginShiftTypeEdit = (shiftType: ShiftType) => {
    setEditingShiftTypeId(shiftType.id)
    setShiftTypeDraft({ name: shiftType.name, icon: shiftType.icon ?? '🕐', start: shiftType.scheduledStart, end: shiftType.scheduledEnd })
    setDataError('')
    setShiftTypeMessage('')
  }

  const saveShiftTypeEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || !editingShiftTypeId) {
      setDataError('Select a shift type to edit.')
      return
    }
    const name = shiftTypeDraft.name.trim()
    if (!name || !shiftTypeDraft.start || !shiftTypeDraft.end) {
      setDataError('Enter a shift name, start time, and end time.')
      return
    }

    setSavingShiftTypeEdit(true)
    setDataError('')
    setShiftTypeMessage('')
    try {
      const response = await apiFetch<{ shiftType: ShiftType }>('/api/shift-types', {
        method: 'PATCH',
        body: JSON.stringify({
          businessId: session.user.businessId,
          id: editingShiftTypeId,
          name,
          icon: shiftTypeDraft.icon,
          scheduledStart: shiftTypeDraft.start,
          scheduledEnd: shiftTypeDraft.end,
        }),
      })
      setShiftTypes(types => orderShiftTypes(types.map(type => type.id === response.shiftType.id ? response.shiftType : type)))
      setShiftTypeMessage(`${response.shiftType.name} shift type updated.`)
      setEditingShiftTypeId(null)
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to update shift type.')
    } finally {
      setSavingShiftTypeEdit(false)
    }
  }

  const deleteShiftType = async (shiftType: ShiftType) => {
    if (!session || !window.confirm(`Remove "${shiftType.name}" from available shift types? Past shift history will be preserved.`)) return

    setDeletingShiftTypeId(shiftType.id)
    setDataError('')
    setShiftTypeMessage('')
    try {
      await apiFetch(`/api/shift-types?id=${encodeURIComponent(shiftType.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setShiftTypes(types => types.filter(type => type.id !== shiftType.id))
      setSelectedShift(selected => selected === shiftType.id ? '' : selected)
      setShiftTypeMessage(`${shiftType.name} was removed. Past shift history is preserved.`)
      if (editingShiftTypeId === shiftType.id) setEditingShiftTypeId(null)
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to delete shift type.')
    } finally {
      setDeletingShiftTypeId(null)
    }
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
            {staffList.length === 0 && <div style={{ padding: '16px', fontSize: 12, color: c.muted, lineHeight: 1.5 }}>No available active cashiers or supervisors. Add an active employee with the Cashier or Supervisor role, or end their current shift first.</div>}
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

          <button className="btn" disabled={!selectedStaff || !selectedShift} onClick={startShift} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #2E7D32, #388E3C)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: !selectedStaff || !selectedShift ? 'not-allowed' : 'pointer', opacity: !selectedStaff || !selectedShift ? 0.5 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(46,125,50,0.35)' }}>
            ▶ Start Shift Now
          </button>
        </div>
      </div>
    )
  }

  // ── Active Shift ─────────────────────────────────────────────────────────
  if (view === 'active' && activeShift) {
    const activeShiftDuration = formatElapsedShiftDuration(activeShift.openedAt, clockNow)
    const activeShiftOvertime = hasExceededShiftDuration(activeShift.openedAt, clockNow)
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
          <div className="card" style={{ padding: '20px', marginBottom: 16, border: activeShiftOvertime ? '1px solid #C62828' : undefined, boxShadow: activeShiftOvertime ? '0 0 0 1px rgba(198,40,40,0.14)' : undefined }}>
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
                { label: 'Elapsed', value: activeShiftDuration },
                { label: 'Sales', value: String(activeShift.sales) },
                { label: 'Revenue', value: `KSh ${activeShift.amount.toLocaleString()}` },
              ].map(stat => (
                <div key={stat.label} style={{ background: c.cardAlt, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: c.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{stat.label}</div>
                  <div className={stat.label === 'Elapsed' ? 'live-shift-badge' : undefined} style={{ fontSize: 13, fontWeight: 800, color: stat.label === 'Elapsed' && activeShiftOvertime ? '#C62828' : c.text }}>{stat.value}</div>
                  {stat.label === 'Elapsed' && <div style={{ fontSize: 9, color: c.muted, marginTop: 3 }}>{formatShiftRange(activeShift.openedAt, null)}</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: activeShiftOvertime ? (c.isDark ? 'rgba(198,40,40,0.14)' : '#FFEBEE') : c.successBg, border: `1px solid ${activeShiftOvertime ? (c.isDark ? 'rgba(198,40,40,0.5)' : '#EF9A9A') : (c.isDark ? 'rgba(46,125,50,0.3)' : '#C8E6C9')}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: activeShiftOvertime ? '#C62828' : '#2E7D32', marginBottom: 4 }}>
              {activeShiftOvertime ? '● Shift exceeded 8 hours' : '🟢 Shift in progress'}
            </div>
            <div style={{ fontSize: 12, color: c.muted }}>
              {activeShiftOvertime
                ? 'This shift should be closed. Please end it when ready.'
                : `All POS sales during this shift are being tracked and attributed to ${activeShift.cashier.split(' ')[0]}.`}
            </div>
          </div>

          <button className="btn" onClick={endShift} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(211,47,47,0.35)' }}>
            ■ End Shift
          </button>
        </div>
      </div>
    )
  }

  if (view === 'types') {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setView('list')} aria-label="Back to shift management" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Shift Types</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                Reusable employee time slots · {shiftTypes.length} available {shiftTypes.length === 1 ? 'shift' : 'shifts'}
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
          {dataError && <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: c.errorBg, color: '#C62828', fontSize: 12 }}>{dataError}</div>}
          {shiftTypeMessage && <div role="status" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: c.successBg, color: '#2E7D32', fontSize: 12 }}>{shiftTypeMessage}</div>}

          <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 8px 4px' }}>Available Shifts</div>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            {shiftTypes.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: c.muted }}>No shift types yet. Create your first time slot below.</div>
            ) : shiftTypes.map((shift, index) => {
              const isEditing = editingShiftTypeId === shift.id
              const isDeleting = deletingShiftTypeId === shift.id
              return (
                <div key={shift.id} style={{ display: 'flex', alignItems: isEditing ? 'flex-start' : 'center', gap: 12, padding: '13px 12px', borderBottom: index < shiftTypes.length - 1 ? c.divider : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.tint(shift.color ?? '#123A8F'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{isEditing ? shiftTypeDraft.icon : shift.icon ?? '🕐'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <form id={`edit-shift-type-${shift.id}`} onSubmit={saveShiftTypeEdit}>
                        {renderShiftIconPicker(shiftTypeDraft.icon, icon => setShiftTypeDraft(draft => ({ ...draft, icon })), `edit-icon-${shift.id}`)}
                        <input
                          className="input"
                          aria-label="Shift name"
                          required
                          maxLength={60}
                          value={shiftTypeDraft.name}
                          onChange={event => setShiftTypeDraft(draft => ({ ...draft, name: event.target.value }))}
                          style={{ marginBottom: 8 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: c.muted }}>
                            Starts
                            <input className="input" aria-label="Shift start time" type="time" required value={shiftTypeDraft.start} onChange={event => setShiftTypeDraft(draft => ({ ...draft, start: event.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }} />
                          </label>
                          <label style={{ fontSize: 10, fontWeight: 600, color: c.muted }}>
                            Ends
                            <input className="input" aria-label="Shift end time" type="time" required value={shiftTypeDraft.end} onChange={event => setShiftTypeDraft(draft => ({ ...draft, end: event.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }} />
                          </label>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{shift.name}</div>
                        <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{formatShiftTime(shift.scheduledStart)} – {formatShiftTime(shift.scheduledEnd)}</div>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn" type="submit" form={`edit-shift-type-${shift.id}`} disabled={savingShiftTypeEdit} aria-label={`Save ${shift.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.successBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </button>
                      <button className="btn" type="button" onClick={() => setEditingShiftTypeId(null)} disabled={savingShiftTypeEdit} aria-label="Cancel editing shift type" style={{ width: 30, height: 30, borderRadius: 8, background: c.cardAlt, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, cursor: 'pointer' }}>
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m18 6-12 12M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div style={{ padding: '4px 8px', borderRadius: 100, background: c.cardAlt, color: c.muted, fontSize: 10, fontWeight: 600 }}>
                        {shift.scheduledStart}–{shift.scheduledEnd}
                      </div>
                      <button className="btn" onClick={() => beginShiftTypeEdit(shift)} aria-label={`Edit ${shift.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button className="btn" onClick={() => void deleteShiftType(shift)} disabled={isDeleting || deletingShiftTypeId !== null} aria-label={`Delete ${shift.name}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isDeleting ? 'wait' : 'pointer' }}>
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4 }}>Create shift type</div>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.45, marginBottom: 14 }}>Employees will eventually choose from these scheduled time slots.</div>
            <form onSubmit={saveShiftType}>
              {renderShiftIconPicker(newShiftIcon, setNewShiftIcon, 'new-shift-icon')}
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="shift-type-name" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Shift name</label>
                <input id="shift-type-name" className="input" required maxLength={60} value={newShiftName} onChange={event => setNewShiftName(event.target.value)} placeholder="e.g. Weekend, Split Shift" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="shift-type-start" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Starts</label>
                  <input id="shift-type-start" className="input" type="time" required value={newShiftStart} onChange={event => setNewShiftStart(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="shift-type-end" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: c.muted, marginBottom: 5 }}>Ends</label>
                  <input id="shift-type-end" className="input" type="time" required value={newShiftEnd} onChange={event => setNewShiftEnd(event.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: c.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, color: c.muted }}>Time slot preview</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{newShiftStart && newShiftEnd ? `${formatShiftTime(newShiftStart)} – ${formatShiftTime(newShiftEnd)}` : 'Choose start and end times'}</div>
              </div>
              <button className="btn" type="submit" disabled={savingShiftType} style={{ width: '100%', marginTop: 14, padding: 14, background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, color: 'white', fontSize: 14, fontWeight: 700, cursor: savingShiftType ? 'wait' : 'pointer', opacity: savingShiftType ? 0.65 : 1, fontFamily: 'inherit' }}>
                {savingShiftType ? 'Adding…' : 'Add Shift Type'}
              </button>
            </form>
          </div>
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
          <button className="btn" aria-label="Manage shift types" onClick={() => { setDataError(''); setShiftTypeMessage(''); setView('types') }} style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.4A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.4A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.5a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.9v4h-.9A1.7 1.7 0 0 0 19.4 15Z" /></svg>
          </button>
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
            {shifts.map(s => {
              const isOvertime = !s.end && hasExceededShiftDuration(s.openedAt, clockNow)
              const duration = s.closedAt
                ? formatShiftDuration(s.openedAt, s.closedAt)
                : formatElapsedShiftDuration(s.openedAt, clockNow)
              return (
              <div key={s.id} className="card" onClick={() => { if (!s.end) { setActiveShift(s); setView('active') } }} style={{ padding: '14px 16px', marginBottom: 10, cursor: s.end ? 'default' : 'pointer', border: isOvertime ? '1px solid #C62828' : undefined, boxShadow: isOvertime ? '0 0 0 1px rgba(198,40,40,0.14)' : undefined }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 7px', fontSize: 11, color: c.muted }}>
                      <span>{formatShiftRange(s.openedAt, s.closedAt)} · {s.sales} sales</span>
                      <span
                        className={s.closedAt ? undefined : 'live-shift-badge'}
                        title={s.closedAt ? 'Time between shift opening and closing' : 'Elapsed shift time'}
                        aria-label={`${s.closedAt ? 'Shift duration' : 'Elapsed shift time'} ${duration}`}
                        style={{ padding: '2px 6px', borderRadius: 6, background: isOvertime ? (c.isDark ? 'rgba(198,40,40,0.2)' : '#FFEBEE') : c.cardAlt, color: isOvertime ? '#C62828' : c.text, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {duration}
                      </span>
                      {isOvertime && <span style={{ color: '#C62828', fontSize: 10, fontWeight: 700 }}>Over 8h · close shift</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>KSh {s.amount.toLocaleString()}</div>
                    <span className={s.end ? 'badge badge-success' : 'badge live-shift-badge'} style={{ fontSize: 10, marginTop: 4, color: s.end ? undefined : '#2E7D32', background: s.end ? undefined : '#E8F5E9' }}>{s.end ? 'Closed' : '● In Progress'}</span>
                  </div>
                </div>
              </div>
            )})}
          </div>
        ))}
      </div>
    </div>
  )
}
