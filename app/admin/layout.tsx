import type { ReactNode } from 'react'
import { AdminLayout } from './AdminPortal'
import { ThemeProvider } from '../context/ThemeContext'
import './admin.css'

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider>
      <AdminLayout>{children}</AdminLayout>
    </ThemeProvider>
  )
}
