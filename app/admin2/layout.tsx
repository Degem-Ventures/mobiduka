import type { ReactNode } from "react"
import { AdminLayout } from "../admin/AdminPortal2"
import AdminAuthGate from "../admin/AdminAuthGate"
import { ThemeProvider } from "../context/ThemeContext"

export default function Admin2Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider>
      <AdminAuthGate>
        <AdminLayout>{children}</AdminLayout>
      </AdminAuthGate>
    </ThemeProvider>
  )
}
