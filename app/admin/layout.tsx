import type { ReactNode } from 'react'
import { AdminLayout } from './AdminPortal'
import './admin.css'

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminLayout>{children}</AdminLayout>
}
