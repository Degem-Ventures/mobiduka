import type { ReactNode } from "react"
import { AdminLayout } from "./AdminPortal"
import AdminAuthGate from "./AdminAuthGate"
import { ThemeProvider } from "../context/ThemeContext"
import "./admin.css"

export default function AdminRootLayout({
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
