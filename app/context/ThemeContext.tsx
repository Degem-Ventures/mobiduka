"use client"; // Ensure the client directive shell is explicit for context providers

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'

interface ThemeCtx {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', setTheme: () => {}, isDark: false })

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 1. Initialize with safe static defaults to prevent server compilation exceptions
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [sysDark, setSysDark] = useState(false)

  // 2. Safely read browser variables ONLY after the layout mounts onto the client device
  useEffect(() => {
    // A. Safely recover the custom merchant dark/light theme tracking choice
    try {
      const savedTheme = localStorage.getItem('md_theme') as ThemeMode
      if (savedTheme) setThemeState(savedTheme)
    } catch {}

    // B. Reconcile system color preferences natively using matchMedia parameters
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSysDark(mq.matches)

    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isDark = theme === 'dark' || (theme === 'auto' && sysDark)

  const setTheme = (t: ThemeMode) => {
    setThemeState(t)
    try { 
      localStorage.setItem('md_theme', t) 
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
