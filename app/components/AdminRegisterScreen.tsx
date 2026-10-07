import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'
import { useAutoDismissMessage } from '../../lib/use-auto-dismiss-message'

type Role = { id: string; name: string; icon: string; permissions: string[] }
type RolesResponse = { roles: Role[] }
const permissionLabels: Record<string, string> = {
  pos: 'Process sales', discount: 'Apply discounts', void: 'Void / refund', credit: 'Credit sales',
  inventory_v: 'View inventory', inventory_e: 'Edit products', categories: 'Categories', reports: 'Reports', export: 'Export data',
  customers: 'Customers', suppliers: 'Suppliers', expenses: 'Expenses', credit_book: 'Credit book', employees: 'Employees',
  register: 'Register users', settings: 'Settings', payments: 'Payment methods', roles: 'Manage roles', shifts: 'Manage shifts', shifts_v: 'Shift reports',
}

const branches = ['Nairobi CBD', 'Westlands', 'Karen', 'Thika Rd', 'Mombasa']

export type EmployeeDraft = { id: string; name: string; phone: string; email: string; roleId: string; shift: string; salary: number; active: boolean; hasPin: boolean; startDate?: string }
interface Props { onNavigate: (s: string) => void; employee?: EmployeeDraft | null; onComplete?: () => void }

export default function AdminRegisterScreen({ onNavigate, employee, onComplete }: Props) {
  const c = useColors()
  const [step, setStep] = useState<'form' | 'pin' | 'done'>('form')
  const [form, setForm] = useState({
    name: employee?.name ?? '', phone: employee?.phone ?? '', email: employee?.email ?? '', role: employee?.roleId ?? '', branch: 'Nairobi CBD', department: '',
  })
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [pinError, setPinError] = useAutoDismissMessage()
  const [showWorkDetails, setShowWorkDetails] = useState(false)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [workShift, setWorkShift] = useState(employee?.shift ?? 'Morning')
  const [salary, setSalary] = useState(employee ? String(employee.salary) : '')

  const returnToEmployees = () => {
    onComplete?.()
    onNavigate('employees')
  }
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesError, setRolesError] = useAutoDismissMessage()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const session = getClientSession()
    if (!session) { setRolesError('Please sign in to load roles.'); return }
    void apiFetch<RolesResponse>(`/api/roles?businessId=${encodeURIComponent(session.user.businessId)}`)
      .then(response => {
        setRoles(response.roles)
        setForm(current => current.role || !response.roles.length ? current : { ...current, role: response.roles.find(role => role.name === 'Cashier')?.id ?? response.roles[0].id })
      })
      .catch(reason => setRolesError(reason instanceof Error ? reason.message : 'Unable to load roles.'))
  }, [])

  const initials = form.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const canProceed = form.name.trim() && form.phone.trim() && form.email.trim()

  const handlePinSave = async () => {
    if (!employee && pin.length < 4) { setPinError('PIN must be 4 digits'); return }
    if (employee?.hasPin && pin && currentPin.length !== 4) { setPinError('Enter the current 4-digit PIN.'); return }
    if (pin && pin.length < 4) { setPinError('PIN must be 4 digits'); return }
    if (pin !== confirmPin) { setPinError('PINs do not match'); return }
    setPinError('')
    const session = getClientSession()
    if (!session) { setPinError('Please sign in to create an account.'); return }
    setCreating(true)
    try {
      await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, ...(employee ? { id: employee.id, isActive: employee.active, startDate: employee.startDate } : {}), name: form.name, phone: form.phone, email: form.email, roleId: form.role, shift: workShift, salary: Number(salary || 0), ...(pin ? { pin, currentPin } : {}) }) })
      setStep('done')
    } catch (reason) { setPinError(reason instanceof Error ? reason.message : 'Unable to create the account.') }
    finally { setCreating(false) }
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
            {role?.icon} {role?.name} · {form.branch}
          </div>
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 14, padding: '16px 20px', width: '100%', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32', marginBottom: 6 }}>✅ {employee ? 'Employee Updated Successfully' : 'Account Created Successfully'}</div>
            <div style={{ fontSize: 12, color: c.muted }}>{employee ? `${form.name}'s details have been saved.` : `Login credentials sent to ${form.email}`}</div>
            {!employee && <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>User can log in with their PIN or password</div>}
          </div>
          <button className="btn" onClick={returnToEmployees} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Back to Staff
          </button>
          {!employee && <button className="btn" onClick={() => { setStep('form'); setForm({ name: '', phone: '', email: '', role: roles.find(role => role.name === 'Cashier')?.id ?? roles[0]?.id ?? '', branch: 'Nairobi CBD', department: '' }); setPin(''); setConfirmPin('') }} style={{ marginTop: 12, background: 'none', border: 'none', color: '#123A8F', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Register Another User</button>}
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
            <button className="btn" onClick={returnToEmployees} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{employee ? 'Update Employee' : 'Set Login PIN'}</div>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>4-Digit PIN {employee ? '(leave blank to keep current PIN)' : '*'}</label>
              <input
                type="password" inputMode="numeric" maxLength={4}
                placeholder={employee ? 'Leave blank to keep current PIN' : '••••'}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                className="input"
                style={{ textAlign: 'center', fontSize: 32, letterSpacing: 16, fontWeight: 800 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Confirm PIN {employee ? '(if changing)' : '*'}</label>
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
            {!employee && <div style={{ background: c.warningBg, border: `1px solid ${c.isDark ? 'rgba(249,168,37,0.3)' : '#FFE082'}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: c.isDark ? '#F9A825' : '#8D6E63' }}>🔒 Ask the user to change this PIN at their first login</div>}
          </div>
          <button className="btn" onClick={() => void handlePinSave()} disabled={creating} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: 'white', cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {creating ? 'Saving…' : employee ? 'Save Employee' : 'Create Account'}
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
          <button className="btn" onClick={returnToEmployees} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{employee ? 'Edit Employee' : 'Add Employee'}</div>
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
          {rolesError && <div style={{ background: c.errorBg, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#D32F2F', marginBottom: 10 }}>{rolesError}</div>}
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
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{r.name}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{r.permissions.length} permissions</div>
              </button>
            ))}
            {!rolesError && roles.length === 0 && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: c.muted, padding: 8 }}>Loading roles…</div>}
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

        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          <button className="btn" onClick={() => setShowWorkDetails(value => !value)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ fontSize: 19 }}>💼</span><span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: c.text }}>Optional Work Details</span><span style={{ color: c.muted, fontSize: 15 }}>{showWorkDetails ? '⌃' : '⌄'}</span>
          </button>
          {showWorkDetails && <div style={{ padding: '0 16px 16px', borderTop: c.divider }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.muted, margin: '14px 0 8px' }}>Shift</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{['Morning', 'Afternoon', 'Evening'].map(shift => <button key={shift} className="btn" onClick={() => setWorkShift(shift)} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: workShift === shift ? '2px solid #123A8F' : `1.5px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, background: workShift === shift ? (c.isDark ? 'rgba(18,58,143,0.25)' : 'rgba(18,58,143,0.08)') : c.card, color: workShift === shift ? '#123A8F' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{shift}</button>)}</div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Monthly Salary (KSh)</label>
            <input className="input" type="number" min="0" placeholder="0" value={salary} onChange={event => setSalary(event.target.value)} />
          </div>}
        </div>

        {/* Permissions summary */}
        <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>{roles.find(r => r.id === form.role)?.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{roles.find(r => r.id === form.role)?.name ?? 'Role'} Permissions</div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 3, marginBottom: 8 }}>{roles.find(r => r.id === form.role)?.permissions.length ?? 0} enabled permissions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '5px 8px' }}>
              {(roles.find(r => r.id === form.role)?.permissions ?? []).map(permission => <div key={permission} style={{ fontSize: 10, lineHeight: 1.25, color: c.text, minWidth: 0 }}>• {permissionLabels[permission] ?? permission.replace(/_/g, ' ')}</div>)}
            </div>
          </div>
        </div>

        {showPinSetup && <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 14 }}>🔐 {employee ? 'Change Login PIN' : 'Set Login PIN'}</div>
          {employee?.hasPin && <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Current PIN *</label><input className="input" type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={event => { setCurrentPin(event.target.value.replace(/\D/g, '')); setPinError('') }} placeholder="••••" style={{ textAlign: 'center', letterSpacing: 10, fontSize: 20 }} /></div>}
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>New 4-Digit PIN *</label><input className="input" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '')); setPinError('') }} placeholder="••••" style={{ textAlign: 'center', letterSpacing: 10, fontSize: 20 }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Repeat New PIN *</label><input className="input" type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={event => { setConfirmPin(event.target.value.replace(/\D/g, '')); setPinError('') }} placeholder="••••" style={{ textAlign: 'center', letterSpacing: 10, fontSize: 20 }} /></div>
          {pinError && <div style={{ color: '#D32F2F', fontSize: 12, marginTop: 10 }}>⚠️ {pinError}</div>}
          <button className="btn" onClick={() => void handlePinSave()} disabled={creating} style={{ width: '100%', marginTop: 16, padding: '14px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 700, color: 'white', cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: 'inherit' }}>{creating ? 'Saving…' : employee ? 'Save Employee' : 'Create Account'}</button>
        </div>}

        {!showPinSetup && <button className="btn" onClick={() => setShowPinSetup(true)} disabled={!canProceed || !form.role} style={{
          width: '100%', padding: '16px',
          background: canProceed && form.role ? 'linear-gradient(135deg, #123A8F, #1A4FBF)' : (c.isDark ? '#162B5A' : '#E3EAF8'),
          border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700,
          color: canProceed && form.role ? 'white' : c.muted,
          cursor: canProceed && form.role ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          Next: Set Login PIN →
        </button>}
      </div>
    </div>
  )
}
