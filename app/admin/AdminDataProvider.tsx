"use client"

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  initialLicenses,
  initialTenants,
  initialUsers,
  type LicenseRecord,
  type Tenant,
  type UserRecord,
} from './admin-data'

export type AdminModalType = 'tenant' | 'user' | 'license' | null

type AdminDataContextValue = {
  tenants: Tenant[]
  setTenants: Dispatch<SetStateAction<Tenant[]>>
  users: UserRecord[]
  setUsers: Dispatch<SetStateAction<UserRecord[]>>
  licenses: LicenseRecord[]
  setLicenses: Dispatch<SetStateAction<LicenseRecord[]>>
  period: '30 Days' | 'Quarter' | 'Year'
  setPeriod: Dispatch<SetStateAction<'30 Days' | 'Quarter' | 'Year'>>
  monitorOpen: boolean
  setMonitorOpen: Dispatch<SetStateAction<boolean>>
  createModal: AdminModalType
  openCreate: (type: Exclude<AdminModalType, null>) => void
  closeCreate: () => void
  createRecord: (payload: Record<string, string>) => void
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null)

export function useAdminData() {
  const context = useContext(AdminDataContext)
  if (!context) throw new Error('Admin pages must be rendered inside AdminDataProvider.')
  return context
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [users, setUsers] = useState<UserRecord[]>(initialUsers)
  const [licenses, setLicenses] = useState<LicenseRecord[]>(initialLicenses)
  const [period, setPeriod] = useState<'30 Days' | 'Quarter' | 'Year'>('30 Days')
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [createModal, setCreateModal] = useState<AdminModalType>(null)

  const openCreate = (type: Exclude<AdminModalType, null>) => setCreateModal(type)
  const closeCreate = () => setCreateModal(null)

  const createRecord = (payload: Record<string, string>) => {
    if (createModal === 'tenant') {
      setTenants(current => [{
        id: `TEN-KE-${String(1900 + current.length).padStart(5, '0')}`,
        business: payload.business,
        location: payload.location,
        owner: payload.owner,
        email: payload.email,
        plan: payload.plan,
        status: 'trial',
        cache: '0 MB',
        mpesa: payload.shortcode,
        type: payload.accountType as Tenant['type'],
        reference: payload.reference || 'MOBIDUKA',
        lastSync: 'Not synced',
      }, ...current])
    } else if (createModal === 'user') {
      const names = payload.legal.trim().split(/\s+/)
      setUsers(current => [{
        initials: names.map(name => name[0]).join('').slice(0, 2).toUpperCase(),
        display: `${names[0]} ${names[1]?.[0] ? `${names[1][0]}.` : ''}`.trim(),
        legal: payload.legal,
        email: payload.email,
        id: `UID-${3001035 + current.length}`,
        role: payload.role,
        tenant: payload.tenant,
        sessions: 0,
        lastSeen: 'Invitation pending',
        status: 'invited',
      }, ...current])
    } else if (createModal === 'license') {
      const expiry = new Date(payload.expires)
      const days = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
      setLicenses(current => [{
        id: `LIC-${88202 + current.length}`,
        tenant: payload.tenant,
        plan: payload.plan,
        expires: expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        days,
        renewal: true,
        amount: Number(payload.amount),
        status: 'active',
      }, ...current])
    }
    closeCreate()
  }

  return (
    <AdminDataContext.Provider value={{
      tenants, setTenants,
      users, setUsers,
      licenses, setLicenses,
      period, setPeriod,
      monitorOpen, setMonitorOpen,
      createModal, openCreate, closeCreate, createRecord,
    }}>
      {children}
    </AdminDataContext.Provider>
  )
}
