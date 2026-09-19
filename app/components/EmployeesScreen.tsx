import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Role = 'Store Manager' | 'Cashier' | 'Stock Keeper' | 'Supervisor' | 'Accountant'

interface Employee {
  id: string
  name: string
  role: Role
  phone: string
  email: string
  pin: string
  shift: string
  salary: number
  startDate: string
  active: boolean
  initials: string
  color: string
}

const roleFromApi = (role: string): Role => ({ OWNER: 'Store Manager', ADMIN: 'Store Manager', SUPERVISOR: 'Supervisor', STOCK_KEEPER: 'Stock Keeper', ACCOUNTANT: 'Accountant', CASHIER: 'Cashier' }[role] as Role ?? 'Cashier')
const roleToApi = (role: Role) => ({ 'Store Manager': 'OWNER', Supervisor: 'SUPERVISOR', 'Stock Keeper': 'STOCK_KEEPER', Accountant: 'ACCOUNTANT', Cashier: 'CASHIER' }[role])

const roleColors: Record<Role, string> = {
  'Store Manager': '#123A8F',
  'Cashier': '#2E7D32',
  'Stock Keeper': '#00796B',
  'Supervisor': '#7B1FA2',
  'Accountant': '#D4AF37',
}
const rolePerms: Record<Role, string[]> = {
  'Store Manager': ['Full Access', 'Edit Settings', 'Manage Staff', 'View Reports', 'Process Sales', 'Manage Inventory', 'Add Expenses'],
  'Supervisor': ['View Reports', 'Process Sales', 'Manage Inventory', 'Override Discount', 'View Expenses'],
  'Cashier': ['Process Sales', 'View Products', 'View Customers'],
  'Stock Keeper': ['Manage Inventory', 'View Products', 'Create Purchase Orders'],
  'Accountant': ['View Reports', 'View Expenses', 'Export Data', 'Manage Credit'],
}

interface Props { onNavigate: (s: string) => void }

export default function EmployeesScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [list, setList] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ name: '', role: 'Cashier' as Role, phone: '', email: '', pin: '', shift: 'Morning', salary: '' })
  const [dataError, setDataError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadEmployees = async () => {
    if (!session) { setDataError('Please sign in to load employees.'); return }
    try {
      const response = await apiFetch<{ employees: Array<{ id: string; fullName: string; role: string; phone: string | null; email: string | null; status: string; shift: string; salary: number; startDate: string }> }>(`/api/employees?businessId=${encodeURIComponent(session.user.businessId)}`)
      setList(response.employees.map((employee, index) => ({
        id: employee.id,
        name: employee.fullName,
        role: roleFromApi(employee.role),
        phone: employee.phone ?? '',
        email: employee.email ?? '',
        pin: '',
        shift: employee.shift,
        salary: Number(employee.salary),
        startDate: new Date(employee.startDate).toLocaleDateString(),
        active: employee.status === 'ACTIVE',
        initials: employee.fullName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase(),
        color: ['#123A8F', '#2E7D32', '#D32F2F', '#F57C00', '#7B1FA2'][index % 5] ?? '#123A8F',
      })))
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to load employees.') }
  }

  useEffect(() => { void loadEmployees() }, [session?.user.businessId])

  const _openAdd = () => {
    setEditing(null)
    setForm({ name: '', role: 'Cashier', phone: '', email: '', pin: '', shift: 'Morning', salary: '' })
    setShowForm(true)
  }
  void _openAdd

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setForm({ name: emp.name, role: emp.role, phone: emp.phone, email: emp.email, pin: emp.pin, shift: emp.shift, salary: String(emp.salary) })
    setShowForm(true)
    setSelected(null)
  }

  const saveForm = async () => {
    if (!session || !form.name.trim()) return
    setSaving(true)
    try {
      await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, id: editing?.id, name: form.name, role: roleToApi(form.role), phone: form.phone, email: form.email, pin: form.pin || undefined, shift: form.shift, salary: Number(form.salary || 0), isActive: editing?.active ?? true, startDate: editing?.startDate }) })
      await loadEmployees()
      setShowForm(false)
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to save employee.') }
    finally { setSaving(false) }
  }

  const toggleActive = async (employee: Employee) => {
    if (!session) return
    try {
      await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, id: employee.id, name: employee.name, role: roleToApi(employee.role), phone: employee.phone, email: employee.email, shift: employee.shift, salary: employee.salary, isActive: !employee.active }) })
      await loadEmployees()
    } catch (reason) { setDataError(reason instanceof Error ? reason.message : 'Unable to change employee status.') }
  }

  if (showForm) {
    const isEdit = !!editing
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Edit Employee' : 'Add Employee'}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 16 }}>Personal Information</div>
            {[
              { label: 'Full Name *', key: 'name', placeholder: 'e.g. Kevin Ochieng' },
              { label: 'Phone Number *', key: 'phone', placeholder: '+254 ...' },
              { label: 'Email Address', key: 'email', placeholder: 'name@mobiduka.co.ke' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" placeholder={f.placeholder} value={form[f.key as keyof typeof form] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 16 }}>Role & Access</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>Role *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['Store Manager', 'Supervisor', 'Cashier', 'Stock Keeper', 'Accountant'] as Role[]).map(r => (
                  <button key={r} className="btn" onClick={() => setForm(p => ({ ...p, role: r }))} style={{ padding: '7px 12px', borderRadius: 100, border: form.role === r ? 'none' : '1.5px solid #E8ECF4', background: form.role === r ? roleColors[r] : c.card, color: form.role === r ? 'white' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{ background: c.cardAlt, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, marginBottom: 6 }}>PERMISSIONS FOR {form.role.toUpperCase()}</div>
              {rolePerms[form.role].map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: roleColors[form.role] }} />
                  <div style={{ fontSize: 11, color: c.text }}>{p}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 16 }}>Work Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Shift</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Morning', 'Afternoon', 'Evening'].map(s => (
                  <button key={s} className="btn" onClick={() => setForm(p => ({ ...p, shift: s }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: form.shift === s ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: form.shift === s ? 'rgba(18,58,143,0.08)' : c.card, color: form.shift === s ? '#123A8F' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Monthly Salary (KSh)</label>
              <input className="input" type="number" placeholder="0" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>PIN (4 digits) *</label>
              <input className="input" type="password" maxLength={4} placeholder="****" value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
            </div>
          </div>

          {dataError && <div style={{ marginBottom: 12, color: '#C62828', fontSize: 12 }}>{dataError}</div>}
          <button className="btn" disabled={saving} onClick={() => void saveForm()} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    )
  }

  if (selected) {
    const emp = list.find(e => e.id === selected.id) || selected
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <button className="btn" onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Employee Profile</div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: emp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: 'white' }}>{emp.initials}</div>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{emp.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ background: roleColors[emp.role], borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'white' }}>{emp.role}</span>
                <span className={`badge ${emp.active ? 'badge-success' : 'badge-error'}`}>{emp.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
            {[['Phone', emp.phone], ['Email', emp.email], ['Shift', emp.shift], ['Monthly Salary', `KSh ${emp.salary.toLocaleString()}`], ['Start Date', emp.startDate], ['PIN', '••••']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 5 ? c.divider : 'none' }}>
                <div style={{ fontSize: 12, color: c.muted }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Permissions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rolePerms[emp.role].map((p, i) => (
                <span key={i} className="badge badge-blue">{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => openEdit(emp)} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Edit Details</button>
            <button className="btn" onClick={() => { void toggleActive(emp); setSelected(null) }} style={{ flex: 1, padding: '13px', background: emp.active ? '#FFF5F5' : c.successBg, border: `1px solid ${emp.active ? '#FFCDD2' : '#C8E6C9'}`, borderRadius: 14, fontSize: 13, fontWeight: 600, color: emp.active ? '#D32F2F' : '#2E7D32', cursor: 'pointer', fontFamily: 'inherit' }}>
              {emp.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Employees</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => onNavigate('shifts')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 12, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 15 }}>🕐</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Shifts</span>
            </button>
            <button className="btn" onClick={_openAdd} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 15, color: '#0D1B3D', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3D' }}>Register</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['Total', list.length, 'white'], ['Active', list.filter(e => e.active).length, '#4CAF50'], ['Inactive', list.filter(e => !e.active).length, '#FF6B6B']].map(([l, v, col], i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: String(col) }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {dataError && <div style={{ margin: 12, marginBottom: 0, color: '#C62828', fontSize: 12 }}>{dataError}</div>}
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {list.map(emp => (
          <button key={emp.id} className="btn card" onClick={() => setSelected(emp)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: emp.active ? 1 : 0.6 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: emp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: 'white', flexShrink: 0 }}>{emp.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{emp.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, background: `${roleColors[emp.role]}18`, color: roleColors[emp.role], padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>{emp.role}</span>
                <span style={{ fontSize: 10, color: c.muted }}>{emp.shift} shift</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>KSh {(emp.salary / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 10, color: emp.active ? '#2E7D32' : '#D32F2F', fontWeight: 600, marginTop: 3 }}>● {emp.active ? 'Active' : 'Inactive'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
