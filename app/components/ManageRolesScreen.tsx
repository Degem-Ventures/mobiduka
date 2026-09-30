import { useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'

type Perm = { id: string; label: string; section: string }

const allPerms: Perm[] = [
  { id: 'pos',         label: 'Process Sales (POS)',        section: 'Sales' },
  { id: 'discount',    label: 'Apply Discounts',            section: 'Sales' },
  { id: 'void',        label: 'Void / Refund Sales',        section: 'Sales' },
  { id: 'credit',      label: 'Record Credit Sales',        section: 'Sales' },
  { id: 'inventory_v', label: 'View Inventory',             section: 'Inventory' },
  { id: 'inventory_e', label: 'Edit / Add Products',        section: 'Inventory' },
  { id: 'categories',  label: 'Manage Categories',          section: 'Inventory' },
  { id: 'reports',     label: 'View Reports',               section: 'Reports' },
  { id: 'export',      label: 'Export Data',                section: 'Reports' },
  { id: 'customers',   label: 'Manage Customers',           section: 'CRM' },
  { id: 'suppliers',   label: 'Manage Suppliers',           section: 'CRM' },
  { id: 'expenses',    label: 'Record Expenses',            section: 'Finance' },
  { id: 'credit_book', label: 'View Credit Book',           section: 'Finance' },
  { id: 'employees',   label: 'Manage Employees',           section: 'Admin' },
  { id: 'register',    label: 'Register New Users',         section: 'Admin' },
  { id: 'settings',    label: 'Change App Settings',        section: 'Admin' },
  { id: 'payments',    label: 'Configure Payment Methods',  section: 'Admin' },
  { id: 'roles',       label: 'Manage Roles & Permissions', section: 'Admin' },
  { id: 'shifts',      label: 'Manage Shifts',              section: 'Shifts' },
  { id: 'shifts_v',    label: 'View Shift Reports',         section: 'Shifts' },
]

const sections = [...new Set(allPerms.map(p => p.section))]

interface Role {
  id: string; name: string; icon: string; color: string
  perms: Set<string>; builtin: boolean
}

type RolesResponse = { roles: Array<{ id: string; name: string; icon: string; color: string; isSystem: boolean; permissions: string[]; userCount: number }> }

interface Props { onNavigate: (s: string) => void }

export default function ManageRolesScreen({ onNavigate }: Props) {
  const c = useColors()
  const [roles, setRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<Role | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ name: string; perms: Set<string> } | null>(null)
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRoles = async () => {
    const session = getClientSession()
    if (!session) { setError('Please sign in to manage roles.'); setLoading(false); return }
    try {
      const response = await apiFetch<RolesResponse>(`/api/roles?businessId=${encodeURIComponent(session.user.businessId)}`)
      setRoles(response.roles.map(role => ({ id: role.id, name: role.name, icon: role.icon, color: role.color, builtin: role.isSystem, perms: new Set(role.permissions) })))
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load roles.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadRoles() }, [])

  const openEdit = (r: Role) => {
    setSelected(r)
    setDraft({ name: r.name, perms: new Set(r.perms) })
    setEditing(true)
  }

  const saveRole = async () => {
    if (!draft || !selected) return
    const session = getClientSession(); if (!session) return
    try {
      await apiFetch('/api/roles', { method: 'PATCH', body: JSON.stringify({ businessId: session.user.businessId, roleId: selected.id, ...(selected.builtin ? {} : { name: draft.name }), permissions: [...draft.perms] }) })
      await loadRoles(); setSaved(true); setTimeout(() => setSaved(false), 1800); setEditing(false); setSelected(null); setDraft(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save role.') }
  }

  const togglePerm = (perm: string) => {
    if (!draft) return
    const next = new Set(draft.perms)
    if (next.has(perm)) next.delete(perm); else next.add(perm)
    setDraft({ ...draft, perms: next })
  }

  const addCustomRole = async () => {
    if (!newRoleName.trim()) return
    const session = getClientSession(); if (!session) return
    try { await apiFetch('/api/roles', { method: 'POST', body: JSON.stringify({ businessId: session.user.businessId, name: newRoleName.trim(), permissions: ['pos'] }) }); await loadRoles(); setNewRoleName(''); setShowNewRole(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create role.') }
  }

  const deleteRole = async (roleId: string) => {
    const session = getClientSession(); if (!session) return
    try { await apiFetch('/api/roles', { method: 'DELETE', body: JSON.stringify({ businessId: session.user.businessId, roleId }) }); await loadRoles() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete role.') }
  }

  // ── Edit permissions view ──────────────────────────────────────────────
  if (editing && draft && selected) {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => { setEditing(false); setSelected(null); setDraft(null) }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
                {selected.icon} {selected.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{draft.perms.size} permissions active</div>
            </div>
            <button className="btn" onClick={() => void saveRole()} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#0D1B3D', cursor: 'pointer', fontFamily: 'inherit' }}>
              Save
            </button>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
          {!selected.builtin && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Role Name</label>
              <input className="input" value={draft.name} onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)} />
            </div>
          )}
          {sections.map(sec => {
            const secPerms = allPerms.filter(p => p.section === sec)
            return (
              <div key={sec} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{sec}</div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {secPerms.map((p, i, arr) => (
                    <button key={p.id} className="btn" onClick={() => togglePerm(p.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 16px', border: 'none',
                      borderBottom: i < arr.length - 1 ? c.divider : 'none',
                      background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.text }}>{p.label}</div>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: draft.perms.has(p.id) ? '#123A8F' : (c.isDark ? '#1A3366' : '#E8ECF4'),
                        border: draft.perms.has(p.id) ? 'none' : `1.5px solid ${c.isDark ? '#2A4A80' : '#D0D7E8'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {draft.perms.has(p.id) && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Role list ──────────────────────────────────────────────────────────
  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Roles & Permissions</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{loading ? 'Loading roles…' : `${roles.length} roles · ${allPerms.length} permissions`}</div>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 100 }}>
        {error && <div style={{ background: c.errorBg, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#D32F2F' }}>{error}</div>}
        {saved && (
          <div style={{ background: c.successBg, border: `1px solid ${c.isDark ? 'rgba(46,125,50,0.4)' : '#C8E6C9'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>✅</span><span style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>Role permissions saved</span>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>System Roles</div>
        {roles.filter(r => r.builtin).map(r => (
          <div key={r.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `${r.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{r.name}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{r.perms.size} permissions</div>
            </div>
            <button className="btn" onClick={() => openEdit(r)} style={{ background: c.iconBg, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>
              Edit
            </button>
          </div>
        ))}

        {roles.filter(r => !r.builtin).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, marginTop: 8 }}>Custom Roles</div>
            {roles.filter(r => !r.builtin).map(r => (
              <div key={r.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{r.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{r.perms.size} permissions</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => openEdit(r)} style={{ background: c.iconBg, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  <button className="btn" onClick={() => void deleteRole(r.id)} style={{ background: c.errorBg, border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#D32F2F', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {showNewRole ? (
          <div className="card" style={{ padding: '16px', marginTop: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 8 }}>New Role Name</label>
            <input className="input" placeholder="e.g. Warehouse Staff" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setShowNewRole(false)} style={{ flex: 1, padding: '11px', background: 'none', border: `1px solid ${c.isDark ? '#1A3366' : '#E8ECF4'}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button className="btn" onClick={() => void addCustomRole()} style={{ flex: 2, padding: '11px', background: newRoleName.trim() ? '#123A8F' : c.cardAlt, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: newRoleName.trim() ? 'white' : c.faint, cursor: newRoleName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                Create Role
              </button>
            </div>
          </div>
        ) : (
          <button className="btn" onClick={() => setShowNewRole(true)} style={{ width: '100%', marginTop: 8, padding: '14px', background: 'none', border: `1.5px dashed ${c.isDark ? '#1A3366' : '#D0D7E8'}`, borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#123A8F', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Create Custom Role
          </button>
        )}
      </div>
    </div>
  )
}
