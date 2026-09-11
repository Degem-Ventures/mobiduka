import { useState } from 'react'

type Role = 'Store Manager' | 'Cashier' | 'Stock Keeper' | 'Supervisor' | 'Accountant'

interface Employee {
  id: number
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

const employees: Employee[] = [
  { id: 1, name: 'Admin User', role: 'Store Manager', phone: '0712 345 678', email: 'admin@mobiduka.co.ke', pin: '1234', shift: 'Morning', salary: 55000, startDate: '1 Jan 2024', active: true, initials: 'AU', color: '#123A8F' },
  { id: 2, name: 'Kevin Ochieng', role: 'Cashier', phone: '0723 456 789', email: 'kevin@mobiduka.co.ke', pin: '2345', shift: 'Morning', salary: 28000, startDate: '15 Mar 2024', active: true, initials: 'KO', color: '#2E7D32' },
  { id: 3, name: 'Fatuma Hassan', role: 'Stock Keeper', phone: '0734 567 890', email: 'fatuma@mobiduka.co.ke', pin: '3456', shift: 'Afternoon', salary: 30000, startDate: '1 Jun 2024', active: true, initials: 'FH', color: '#D32F2F' },
  { id: 4, name: 'Brian Mutua', role: 'Cashier', phone: '0745 678 901', email: 'brian@mobiduka.co.ke', pin: '4567', shift: 'Evening', salary: 26000, startDate: '20 Aug 2024', active: false, initials: 'BM', color: '#F57C00' },
  { id: 5, name: 'Linda Auma', role: 'Supervisor', phone: '0756 789 012', email: 'linda@mobiduka.co.ke', pin: '5678', shift: 'Morning', salary: 38000, startDate: '10 Feb 2025', active: true, initials: 'LA', color: '#7B1FA2' },
]

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
  const [list, setList] = useState(employees)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ name: '', role: 'Cashier' as Role, phone: '', email: '', pin: '', shift: 'Morning', salary: '' })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', role: 'Cashier', phone: '', email: '', pin: '', shift: 'Morning', salary: '' })
    setShowForm(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setForm({ name: emp.name, role: emp.role, phone: emp.phone, email: emp.email, pin: emp.pin, shift: emp.shift, salary: String(emp.salary) })
    setShowForm(true)
    setSelected(null)
  }

  const saveForm = () => {
    if (editing) {
      setList(l => l.map(e => e.id === editing.id ? { ...e, ...form, salary: Number(form.salary) } : e))
    }
    setShowForm(false)
  }

  const toggleActive = (id: number) => setList(l => l.map(e => e.id === id ? { ...e, active: !e.active } : e))

  if (showForm) {
    const isEdit = !!editing
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 16 }}>Personal Information</div>
            {[
              { label: 'Full Name *', key: 'name', placeholder: 'e.g. Kevin Ochieng' },
              { label: 'Phone Number *', key: 'phone', placeholder: '+254 ...' },
              { label: 'Email Address', key: 'email', placeholder: 'name@mobiduka.co.ke' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" placeholder={f.placeholder} value={form[f.key as keyof typeof form] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 16 }}>Role & Access</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 8 }}>Role *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['Store Manager', 'Supervisor', 'Cashier', 'Stock Keeper', 'Accountant'] as Role[]).map(r => (
                  <button key={r} className="btn" onClick={() => setForm(p => ({ ...p, role: r }))} style={{ padding: '7px 12px', borderRadius: 100, border: form.role === r ? 'none' : '1.5px solid #E8ECF4', background: form.role === r ? roleColors[r] : 'white', color: form.role === r ? 'white' : '#6B7A99', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{ background: '#F0F3F9', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', marginBottom: 6 }}>PERMISSIONS FOR {form.role.toUpperCase()}</div>
              {rolePerms[form.role].map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: roleColors[form.role] }} />
                  <div style={{ fontSize: 11, color: '#0D1B3D' }}>{p}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D', marginBottom: 16 }}>Work Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Shift</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Morning', 'Afternoon', 'Evening'].map(s => (
                  <button key={s} className="btn" onClick={() => setForm(p => ({ ...p, shift: s }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: form.shift === s ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: form.shift === s ? 'rgba(18,58,143,0.08)' : 'white', color: form.shift === s ? '#123A8F' : '#6B7A99', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>Monthly Salary (KSh)</label>
              <input className="input" type="number" placeholder="0" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: 6 }}>PIN (4 digits) *</label>
              <input className="input" type="password" maxLength={4} placeholder="****" value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
            </div>
          </div>

          <button className="btn" onClick={saveForm} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(18,58,143,0.35)' }}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    )
  }

  if (selected) {
    const emp = list.find(e => e.id === selected.id) || selected
    return (
      <div className="screen" style={{ background: '#F5F7FA' }}>
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
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 5 ? '1px solid #F0F3F9' : 'none' }}>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Permissions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rolePerms[emp.role].map((p, i) => (
                <span key={i} className="badge badge-blue">{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => openEdit(emp)} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg, #123A8F, #1A4FBF)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Edit Details</button>
            <button className="btn" onClick={() => { toggleActive(emp.id); setSelected(null) }} style={{ flex: 1, padding: '13px', background: emp.active ? '#FFF5F5' : '#E8F5E9', border: `1px solid ${emp.active ? '#FFCDD2' : '#C8E6C9'}`, borderRadius: 14, fontSize: 13, fontWeight: 600, color: emp.active ? '#D32F2F' : '#2E7D32', cursor: 'pointer', fontFamily: 'inherit' }}>
              {emp.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Employees</div>
          </div>
          <button className="btn" onClick={openAdd} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['Total', list.length, 'white'], ['Active', list.filter(e => e.active).length, '#4CAF50'], ['Inactive', list.filter(e => !e.active).length, '#FF6B6B']].map(([l, v, c], i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: String(c) }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {list.map(emp => (
          <button key={emp.id} className="btn card" onClick={() => setSelected(emp)} style={{ width: '100%', marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: emp.active ? 1 : 0.6 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: emp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: 'white', flexShrink: 0 }}>{emp.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D' }}>{emp.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, background: `${roleColors[emp.role]}18`, color: roleColors[emp.role], padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>{emp.role}</span>
                <span style={{ fontSize: 10, color: '#6B7A99' }}>{emp.shift} shift</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3D' }}>KSh {(emp.salary / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 10, color: emp.active ? '#2E7D32' : '#D32F2F', fontWeight: 600, marginTop: 3 }}>● {emp.active ? 'Active' : 'Inactive'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
